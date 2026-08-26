import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Bound the connection pool, and do it HERE rather than in .env.
 *
 * Prisma defaults to (2 * cpus + 1) connections per client. On shared hosting
 * that is a good way to exhaust the account's MySQL limit — and every restart
 * or redeploy spawns another client before the old one's connections have gone,
 * so the ceiling is reached from the side you are not watching. Once the server
 * refuses, queries fail INSTANTLY (~1ms) while the app keeps serving pages, so
 * the storefront renders with no products rather than looking broken.
 *
 * Editing the URL in code keeps the credentials in .env untouched and unread.
 */
function connectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const p = url.searchParams;
    // Small and fixed: this app is one modest storefront, not a fleet.
    if (!p.has('connection_limit')) p.set('connection_limit', '5');
    // Wait for a free connection rather than failing the page instantly.
    if (!p.has('pool_timeout')) p.set('pool_timeout', '20');
    // Fail a genuinely unreachable server quickly instead of hanging a render.
    if (!p.has('connect_timeout')) p.set('connect_timeout', '10');
    return url.toString();
  } catch {
    // A URL we cannot parse is still a URL Prisma may understand.
    return raw;
  }
}

function createClient(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: connectionUrl(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Lazy singleton Prisma client.
 *
 * Constructing PrismaClient eagerly at import time breaks the production build
 * on shared hosting: with `PRISMA_CLIENT_ENGINE_TYPE=binary` (which we need,
 * because the Node-API library engine panics with "timer has gone away" inside
 * CloudLinux's CageFS) every instantiation spawns a query-engine child process.
 * Next's "Collecting page data" step imports every route module in one worker,
 * so eager construction spawned an engine per route until the worker died with
 * SIGABRT.
 *
 * The Proxy defers construction to the first real property access — i.e. the
 * first query at runtime — so merely importing a route costs nothing.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = (globalForPrisma.prisma ??= createClient());
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
