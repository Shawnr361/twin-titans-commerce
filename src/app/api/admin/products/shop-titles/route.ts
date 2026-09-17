import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { isCopywriterConfigured } from '@/lib/copywriter';
import {
  applyShopTitle,
  pendingShopTitleIds,
  proposeShopTitle,
} from '@/lib/suppliers/shopTitleJob';

export const dynamic = 'force-dynamic';

/**
 * Rename the existing catalogue by hand, in reviewed batches.
 *
 * New products are named automatically on publish and by the half-hourly cron;
 * this is for the backlog, and for looking before leaping.
 *
 *   {"mode":"preview","limit":8}              proposals only, writes nothing
 *   {"mode":"apply","items":[{productId,from,to}]}  writes exactly those
 *
 * Apply re-checks each item against the guard and against the current title,
 * so a stale or edited preview cannot overwrite anything. Batches stay small
 * because each proposal is a model call inside one request.
 */
const schema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('preview'),
    limit: z.number().int().min(1).max(10).optional(),
    /** Skip this many pending products, to page through a preview. */
    offset: z.number().int().min(0).optional(),
    includeDrafts: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal('apply'),
    items: z
      .array(z.object({ productId: z.string().min(1), from: z.string(), to: z.string().min(1) }))
      .min(1)
      .max(50),
  }),
]);

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  if (parsed.data.mode === 'apply') {
    const results = [];
    for (const item of parsed.data.items) {
      results.push({ ...item, ...(await applyShopTitle(item.productId, item.from, item.to)) });
    }
    return NextResponse.json({
      renamed: results.filter((r) => r.status === 'renamed').length,
      results,
    });
  }

  if (!isCopywriterConfigured()) {
    return NextResponse.json({ error: 'No model key configured.' }, { status: 503 });
  }

  const { limit = 8, offset = 0, includeDrafts = false } = parsed.data;
  const all = await pendingShopTitleIds(10_000, includeDrafts);
  const page = all.slice(offset, offset + limit);

  const proposals = [];
  for (const id of page) {
    const p = await proposeShopTitle(id);
    if (p) proposals.push(p);
  }

  return NextResponse.json({
    pending: all.length,
    offset,
    nextOffset: offset + page.length < all.length ? offset + page.length : null,
    proposals,
  });
}
