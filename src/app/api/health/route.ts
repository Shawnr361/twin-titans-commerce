import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Liveness probe that actually touches the database.
 *
 * WHY A PLAIN PAGE CHECK IS NOT ENOUGH
 * ------------------------------------
 * The failure this exists to catch looks like a healthy app from the outside.
 * With PRISMA_CLIENT_ENGINE_TYPE=binary every client spawns a query-engine
 * child process; when that child dies, Prisma does not error, it BLOCKS. So the
 * Node process stays up and answers anything that does not query — /api/admin/fx
 * returned 401 in 1.4s — while every page hangs until the browser gives up.
 * A keep-alive that only fetches "/" sees a slow page, not a broken one, and
 * cheerfully reports success.
 *
 * So this runs a real query, and bounds it: an unbounded await is exactly the
 * hang we are trying to detect, and a probe that hangs is a probe that never
 * fires. Returns 503 when the database cannot be reached, which is the signal
 * the watchdog cron restarts on.
 *
 * Deliberately public and free of detail — it reports whether the shop works,
 * not what it is made of.
 */

export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 8000;

export async function GET() {
  const started = Date.now();

  let dbOk = false;
  let reason: string | null = null;
  let code: string | null = null;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('database timed out')), DB_TIMEOUT_MS)
      ),
    ]);
    dbOk = true;
  } catch (err) {
    dbOk = false;
    /*
     * Swallowing this was a mistake: "db: false" with no reason is the same
     * dead end whether the engine died, the credentials broke, or the server
     * ran out of connections. Prisma's error CODE distinguishes all three
     * (P1001 unreachable, P1000 auth, P2024 pool exhausted), and the message
     * is truncated so a connection string can never be echoed back in full.
     */
    const e = err as { code?: string; message?: string };
    code = typeof e.code === 'string' ? e.code : null;
    reason = (e.message ?? String(err)).replace(/\s+/g, ' ').slice(0, 240);
  }

  const body = { ok: dbOk, db: dbOk, ms: Date.now() - started, code, reason };

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { 'cache-control': 'no-store, no-cache, must-revalidate' },
  });
}
