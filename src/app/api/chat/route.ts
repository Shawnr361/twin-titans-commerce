import { NextResponse } from 'next/server';
import { z } from 'zod';
import { askChat, isChatConfigured } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const schema = z.object({
  question: z.string().min(1).max(600),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .max(12)
    .optional(),
});

/**
 * RATE LIMIT — the reason this is not a thin wrapper.
 *
 * This is an unauthenticated endpoint that spends real money on every call.
 * Without a cap, one script pointed at it runs the OpenRouter balance to zero
 * and takes the copywriter and everything else down with it.
 *
 * In-memory, per-IP, and therefore imperfect: it resets when Passenger
 * respawns and it is per-process. That is honest for a single-worker app on
 * shared hosting, and it is the difference between "a bad afternoon" and "an
 * empty account". A shared store (Redis) is the upgrade if this ever runs on
 * more than one worker.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  /*
   * Stop the map growing without bound on a long-lived process. Cheap, and it
   * only runs on the rare call that finds the map large.
   */
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }

  return recent.length > MAX_PER_WINDOW;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  if (!isChatConfigured()) {
    return NextResponse.json(
      { error: 'The assistant is not available right now. Please email us.' },
      { status: 503 }
    );
  }

  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: 'That is a lot of questions at once — give it a moment.' },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please type a question.' }, { status: 400 });
  }

  const result = await askChat(parsed.data.history ?? [], parsed.data.question);

  if (!result.reply) {
    /*
     * The provider's own wording is not shown to a shopper — it leaks model
     * names and billing states. It is still returned to the server log path by
     * being the thing we chose not to print.
     */
    return NextResponse.json(
      { error: 'Sorry — I could not answer that just now. Please try again or email us.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply: result.reply });
}
