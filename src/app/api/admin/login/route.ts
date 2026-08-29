import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, createSession } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Brute-force throttle. There was none: the admin password could be guessed at
 * whatever rate the network allowed, forever, with nothing recorded.
 *
 * Keyed on IP AND on the email being tried, so one attacker cannot lock out the
 * real administrator by hammering their address from elsewhere — a naive
 * email-only counter turns a brute-force defence into a denial-of-service.
 *
 * In-memory, which on this single-worker host means it resets when Passenger
 * respawns. That is a real limit and worth stating plainly: it raises the cost
 * of an online guessing attack by orders of magnitude, it does not make one
 * impossible. A persistent store is the upgrade when the app runs on more than
 * one worker.
 */
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(key, recent);

  if (attempts.size > 1000) {
    for (const [k, times] of attempts) {
      if (times.every((t) => now - t >= WINDOW_MS)) attempts.delete(k);
    }
  }
  return recent.length >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const list = attempts.get(key) ?? [];
  list.push(Date.now());
  attempts.set(key, list);
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  }

  /*
   * Everything below is wrapped because an unhandled throw here returns a 500
   * with an EMPTY body — the browser then fails on `res.json()` with
   * "Unexpected end of JSON input", which tells the user nothing and tells us
   * nothing either. That happened for real: the database was unreachable
   * (the host had run out of process slots for Prisma's query engine) and the
   * only visible symptom was a JSON parse error in the login form.
   *
   * A login route must always answer in the shape the client expects, and must
   * log the true cause somewhere a developer can find it.
   */
  const key = `${clientIp(request)}|${parsed.data.email.toLowerCase()}`;

  if (tooManyAttempts(key)) {
    /*
     * 429 with no hint about whether the credentials were right. Saying "too
     * many attempts for this account" would confirm the account exists, which
     * is exactly what the vague 401 below is written to avoid.
     */
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  try {
    const session = await authenticate(parsed.data.email, parsed.data.password);
    if (!session) {
      recordFailure(key);
      console.warn('[admin/login] failed attempt from', clientIp(request));
      // Deliberately vague — never reveal whether the email exists.
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }

    // A successful sign-in clears the counter for this pair.
    attempts.delete(key);
    await createSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/login] failed:', err);
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
