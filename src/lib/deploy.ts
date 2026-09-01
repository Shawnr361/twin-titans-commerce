import { openSync, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Run the host's own deploy script from inside the app.
 *
 * WHY THIS EXISTS
 * ---------------
 * Shipping a change needed Go54's browser terminal. In one evening that panel
 * logged itself out twice and then stopped accepting keystrokes altogether, so
 * four separate builds sat published and undeployed waiting on a human at a
 * keyboard. The store is about to carry ad spend; "we cannot deploy tonight"
 * is not an acceptable state to be in.
 *
 * IT MUST OUTLIVE THE PROCESS THAT STARTS IT
 * ------------------------------------------
 * The script swaps .next and touches tmp/restart.txt, which makes Passenger
 * kill this very worker. A normal child would die with it, half-way through
 * moving directories — the worst possible moment. So the child is detached into
 * its own process group with its output redirected to a file on disk, and the
 * request returns immediately. Progress is read back from that file rather than
 * from the child, because by then there is no child left to ask.
 *
 * THE SCRIPT ITSELF IS NEVER SHIPPED FROM HERE
 * --------------------------------------------
 * ~/server-deploy.sh on the host has diverged from the copy in this repo — it
 * carries an extra step to install the generated Prisma client. This invokes
 * whatever is on the host and never writes it, so a deploy can never silently
 * regress the thing that performs deploys.
 */

const SCRIPT = process.env.DEPLOY_SCRIPT ?? path.join(homedir(), 'server-deploy.sh');
const LOG = path.join(homedir(), 'deploy-web.log');
const LOCK = path.join(homedir(), '.deploy-web.lock');

/** A deploy that has neither finished nor touched its lock in this long is dead. */
const STALE_MS = 10 * 60 * 1000;
/** Two deploys in quick succession are a double-click, not an intention. */
const COOLDOWN_MS = 30 * 1000;

export type DeployState = 'idle' | 'running' | 'done' | 'failed';

export interface DeployStatus {
  state: DeployState;
  /** The build now serving, once the script has confirmed the swap. */
  buildId: string | null;
  startedAt: string | null;
  /** Tail of the script's own output, capped. */
  log: string;
}

/**
 * The script reports its own outcome, and these are the lines that end a run.
 *
 * Deliberately reading the script's words rather than an exit code: the child
 * is detached, so by the time anyone asks there is no process left to report
 * one. The script was already written to never claim success from an echo — it
 * reads the swapped build back off disk before printing VERIFIED — so its own
 * output is the trustworthy signal here.
 */
function terminalLine(log: string): DeployState | null {
  if (/^==> VERIFIED live:/m.test(log)) return 'done';
  if (/already live, nothing to do/m.test(log)) return 'done';
  if (/^FATAL:/m.test(log)) return 'failed';
  return null;
}

export function readDeployStatus(): DeployStatus {
  if (!existsSync(LOG)) {
    return { state: 'idle', buildId: null, startedAt: null, log: '' };
  }

  // Tail only. The log is small, but an unbounded read into a JSON response is
  // the kind of thing that is fine until the day it is not.
  const raw = readFileSync(LOG, 'utf8');
  const log = raw.length > 8000 ? raw.slice(-8000) : raw;

  const finished = terminalLine(log);
  const lockFresh = existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < STALE_MS;

  // No terminal line and no fresh lock means it died without saying so —
  // reported as failed rather than left spinning forever.
  const state: DeployState = finished ?? (lockFresh ? 'running' : 'failed');

  return {
    state,
    buildId: log.match(/VERIFIED live:\s*(\S+)/)?.[1] ?? null,
    startedAt: log.match(/^# started (.+)$/m)?.[1] ?? null,
    log,
  };
}

export interface StartResult {
  ok: boolean;
  detail: string;
}

export function startDeploy(actor: string): StartResult {
  if (!existsSync(SCRIPT)) {
    return { ok: false, detail: `No deploy script at ${SCRIPT} on this host.` };
  }

  const status = readDeployStatus();
  if (status.state === 'running') {
    return { ok: false, detail: 'A deploy is already running. Wait for it to finish.' };
  }

  if (existsSync(LOCK)) {
    const age = Date.now() - statSync(LOCK).mtimeMs;
    if (age < COOLDOWN_MS) {
      return {
        ok: false,
        detail: `A deploy started ${Math.round(age / 1000)}s ago. Give it a moment.`,
      };
    }
    try {
      unlinkSync(LOCK);
    } catch {
      /* A stale lock we cannot clear must not block a deploy for ever. */
    }
  }

  const started = new Date().toISOString();
  try {
    writeFileSync(LOCK, `${started} ${actor}\n`, 'utf8');
    writeFileSync(LOG, `# started ${started}\n# by ${actor}\n`, 'utf8');
  } catch (err) {
    return {
      ok: false,
      detail: `Could not write the deploy log: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  try {
    const out = openSync(LOG, 'a');
    /*
     * An argv array, never a shell string. The script path is a constant and
     * nothing from the request reaches this call, so there is no command string
     * for a request to inject into.
     */
    const child = spawn('/bin/bash', [SCRIPT], {
      detached: true,
      stdio: ['ignore', out, out],
      env: process.env,
    });
    child.unref();
  } catch (err) {
    try {
      unlinkSync(LOCK);
    } catch {
      /* nothing further to try */
    }
    return {
      ok: false,
      detail: `Could not start the deploy: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  return { ok: true, detail: 'Deploy started.' };
}

/** The build this running app was created from, for the "you are here" line. */
export function currentBuildId(): string | null {
  try {
    return readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}
