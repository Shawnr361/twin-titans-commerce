import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { categorise } from '@/lib/categorise';

/**
 * File existing products into collections.
 *
 * This is a maintenance job that would normally be a CLI script, and it was
 * one — until the script proved unrunnable here. Node aborts on startup with
 * `uv_thread_create` failing, because its worker threads count against the
 * account's LVE process cap, which this host keeps close to exhausted. No
 * combination of env vars fixes that; a fresh Node process simply cannot start
 * reliably.
 *
 * So the work happens inside the Passenger worker that is already running. No
 * new process, no thread creation, nothing to exhaust. On a host where
 * spawning is the unreliable part, maintenance belongs in the app.
 *
 * POST { apply: false } reports what it would do and changes nothing.
 * POST { apply: true }  files them.
 */
const schema = z.object({ apply: z.boolean().optional() });

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const apply = parsed.success ? Boolean(parsed.data.apply) : false;

  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        productType: true,
        collections: { select: { collectionId: true } },
      },
    }),
    prisma.collection.findMany({ select: { id: true, handle: true } }),
  ]);

  const byHandle = new Map(collections.map((c) => [c.handle, c.id]));

  const planned: { title: string; handle: string }[] = [];
  const unmatched: string[] = [];
  const missingCollection: { title: string; handle: string }[] = [];
  let alreadyFiled = 0;

  for (const product of products) {
    if (product.collections.length > 0) {
      alreadyFiled++;
      continue;
    }
    const handle = categorise(product.title, product.productType);
    if (!handle) {
      unmatched.push(product.title);
      continue;
    }
    const collectionId = byHandle.get(handle);
    if (!collectionId) {
      missingCollection.push({ title: product.title, handle });
      continue;
    }
    planned.push({ title: product.title, handle });
    if (apply) {
      await prisma.collectionProduct.create({ data: { productId: product.id, collectionId } });
    }
  }

  return NextResponse.json({
    applied: apply,
    totalProducts: products.length,
    collections: collections.map((c) => c.handle),
    filed: planned,
    alreadyFiled,
    // Named plainly: these were left alone on purpose, not skipped by accident.
    noMatch: unmatched,
    collectionMissing: missingCollection,
  });
}
