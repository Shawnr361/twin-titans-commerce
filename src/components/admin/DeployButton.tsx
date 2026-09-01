'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ship the published build to the live site.
 *
 * TWO STEPS, AND THE SECOND ONE SAYS WHAT IT DOES.
 *
 * Same discipline as placing a supplier order: this replaces what every
 * customer is looking at, so the confirm button names the consequence rather
 * than saying "OK", and it disarms itself if left alone.
 *
 * Progress is polled from a file on disk, not streamed. Mid-deploy the server
 * restarts itself — requests fail for a few seconds and that is normal, so a
 * failed poll is ignored rather than reported as an error. The only thing
 * trusted as an outcome is the script's own VERIFIED or FATAL line.
 */
interface Status {
  state: 'idle' | 'running' | 'done' | 'failed';
  buildId: string | null;
  startedAt: string | null;
  log: string;
}

export function DeployButton({ currentBuild }: { currentBuild: string | null }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const timer = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deploy', { cache: 'no-store' });
      if (!res.ok) return; // A restart mid-deploy is expected, not a failure.
      setStatus(await res.json());
    } catch {
      /* Same: the server is briefly gone while it swaps itself. */
    }
  }, []);

  useEffect(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    if (status?.state !== 'running') {
      if (timer.current) window.clearInterval(timer.current);
      return;
    }
    timer.current = window.setInterval(poll, 3000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [status?.state, poll]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/deploy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DEPLOY' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(String(body?.detail ?? body?.error ?? 'Could not start.'));
      else setStatus(body);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  const running = status?.state === 'running';
  const live = status?.buildId;

  return (
    <div className="card space-y-3 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-label text-greige">Deploy</h2>
        {currentBuild && (
          <span className="text-micro text-greige">
            serving <code className="text-onyx">{currentBuild}</code>
          </span>
        )}
      </div>

      <p className="text-micro text-greige">
        Pulls the build already published from the workstation and swaps it in. The first
        page load afterwards is slow while the server starts up again.
      </p>

      {running ? (
        <p className="text-micro text-onyx">Deploying… this takes about 30 seconds.</p>
      ) : armed ? (
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="border border-danger/60 px-3 py-2 text-xs text-danger disabled:opacity-60"
        >
          {busy ? 'Starting…' : 'Confirm — this replaces the live site'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setArmed(true);
            window.setTimeout(() => setArmed(false), 6000);
          }}
          className="btn btn-primary !rounded-full px-5 py-2 text-xs"
        >
          Deploy latest build
        </button>
      )}

      {error && <p className="text-micro text-warn">{error}</p>}

      {status && status.state !== 'idle' && (
        <div className="space-y-1">
          <p
            className={`text-micro ${
              status.state === 'done'
                ? 'text-verdigris'
                : status.state === 'failed'
                  ? 'text-warn'
                  : 'text-greige'
            }`}
          >
            {status.state === 'done' && live
              ? `Live: ${live}`
              : status.state === 'done'
                ? 'Already up to date.'
                : status.state === 'failed'
                  ? 'The deploy did not complete — the log says why.'
                  : 'Running…'}
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words border border-rule p-3 text-micro text-greige">
            {status.log.trim()}
          </pre>
        </div>
      )}
    </div>
  );
}
