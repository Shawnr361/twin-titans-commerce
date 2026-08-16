import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
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
