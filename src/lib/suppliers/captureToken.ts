import { createHash } from 'node:crypto';

/**
 * Bearer token for the cross-origin capture endpoint.
 *
 * Derived from AUTH_SECRET so it is stable across restarts and needs no
 * storage, and rotates automatically if the secret is ever changed.
 *
 * Lives here rather than in the route because a Next.js route module may only
 * export HTTP handlers and a fixed set of config keys — exporting anything
 * else fails the build with a type error against `{ [x: string]: never }`.
 */
export function captureToken(): string {
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < 16) throw new Error('AUTH_SECRET missing or too short');
  return createHash('sha256').update(`${secret}:capture`).digest('hex').slice(0, 32);
}
