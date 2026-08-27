import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ensureDescription, isCopywriterConfigured } from '@/lib/copywriter';
import { htmlToText } from '@/lib/seo';

/**
 * Write product copy for everything that has none.
 *
 * Publishing writes copy from now on, but the catalogue was imported before
 * that existed, so every live product still shows nothing but a supplier title.
 *
 * Dry run by default. Each product costs a model call, so the default has to be
 * "tell me what you would do" rather than "spend money on 36 products".
 *
 * A route rather than a script because node cannot start on this host: its
 * worker threads count against the LVE process cap and abort with
 * uv_thread_create. Inside the Passenger worker there is no process to spawn.
 */

const schema = z.object({
  apply: z.boolean().optional(),
  /** Stop after this many, so a first run can be tried cheaply. */
  limit: z.number().int().min(1).max(200).optional(),
  /** Restrict to one product, for checking the prompt before a bulk run. */
  productId: z.string().optional(),
  includeDrafts: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { apply = false, limit = 10, productId, includeDrafts = false } = parsed.data;

  /*
   * Refuse to write without a key rather than filling the catalogue with the
   * deterministic fallback: copy is never overwritten once written, so a weak
   * pass now would lock out the real copy for good.
   */
  if (apply && !isCopywriterConfigured()) {
    return NextResponse.json(
      {
        error:
          'ANTHROPIC_API_KEY is not set on the server, so no copy would be generated. ' +
          'Add it to the app environment and restart before running this.',
      },
      { status: 503 }
    );
  }

  const products = await prisma.product.findMany({
    where: {
      ...(productId ? { id: productId } : {}),
      ...(includeDrafts ? {} : { status: 'ACTIVE' }),
    },
    select: { id: true, title: true, descriptionHtml: true },
    orderBy: { createdAt: 'asc' },
  });

  const missing = products.filter((p) => htmlToText(p.descriptionHtml ?? '').length <= 40);

  const results: Array<Record<string, unknown>> = [];
  let written = 0;

  for (const product of missing.slice(0, limit)) {
    if (!apply) {
      results.push({ title: product.title.slice(0, 60), action: 'would write' });
      continue;
    }

    const result = await ensureDescription(product.id);
    if (result.written) written++;
    results.push({
      title: product.title.slice(0, 60),
      ...result,
    });
  }

  return NextResponse.json({
    applied: apply,
    /*
     * Surfaced every run: without a key this quietly writes the deterministic
     * fallback instead of real copy, and that difference is invisible in the
     * output otherwise.
     */
    usingModel: isCopywriterConfigured(),
    scope: includeDrafts ? 'all products' : 'live products only',
    productsScanned: products.length,
    missingCopy: missing.length,
    processed: results.length,
    written,
    results,
    note: apply
      ? `Wrote ${written}. Re-run to continue — existing copy is never overwritten.`
      : 'Nothing was changed. Send { "apply": true } to write.',
  });
}
