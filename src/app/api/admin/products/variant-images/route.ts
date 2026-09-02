import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { captureFromApi } from '@/lib/suppliers/aliexpress-fetch';

export const dynamic = 'force-dynamic';

/**
 * Give each variant its own photograph.
 *
 * Products imported through the API all carried the SAME image on every
 * variant, because the mapper looked for the SKU photo under one field name and
 * AliExpress puts it in either of two places. Picking "Blue" changed the price
 * and left the picture on beige — which reads as a broken page, and quietly
 * costs the sale that the colour choice was meant to win.
 *
 * The mapper now finds it by shape, so new imports are correct. This repairs
 * what is already published.
 *
 * MATCHED BY SKU, NEVER BY POSITION
 * ---------------------------------
 * Variants are paired with the supplier's by supplierVariantId. Falling back to
 * array order would be worse than doing nothing: a mismatched list would put
 * the pink photo on the blue option and look deliberate. A variant that cannot
 * be matched keeps the image it has, and is reported.
 *
 * Dry run by default — it changes what a customer sees on every product page.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
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

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const apply = parsed.success ? Boolean(parsed.data.apply) : false;
  const limit = (parsed.success && parsed.data.limit) || 10;
  const offset = (parsed.success && parsed.data.offset) || 0;

  const products = await prisma.product.findMany({
    where: { source: { platform: 'ALIEXPRESS' } },
    select: {
      handle: true,
      title: true,
      source: { select: { externalId: true } },
      variants: {
        select: { id: true, title: true, imageUrl: true, supplierVariantId: true },
      },
    },
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
  });

  const changes: { product: string; variant: string; from: string | null; to: string }[] = [];
  const unmatched: string[] = [];
  let checked = 0;

  for (const p of products) {
    const externalId = p.source?.externalId;
    if (!externalId) continue;
    checked++;

    let supplier;
    try {
      supplier = await captureFromApi(
        externalId,
        `https://www.aliexpress.com/item/${externalId}.html`
      );
    } catch {
      unmatched.push(`${p.title.slice(0, 36)} — lookup failed`);
      continue;
    }
    if (!supplier.capture) continue;

    const bySku = new Map<string, string>();
    for (const v of supplier.capture.variants) {
      if (v.skuId && v.imageUrl) bySku.set(String(v.skuId), v.imageUrl);
    }
    if (bySku.size === 0) {
      unmatched.push(`${p.title.slice(0, 36)} — supplier gives no per-variant photos`);
      continue;
    }

    /*
     * One photo for the whole listing is not a per-variant photo. Applying it
     * would replace a correct fallback with the same thing and report work that
     * did nothing.
     */
    if (new Set(bySku.values()).size <= 1) continue;

    for (const v of p.variants) {
      const sku = v.supplierVariantId;
      if (!sku) {
        unmatched.push(`${p.title.slice(0, 30)} / ${v.title.slice(0, 20)} — no supplier SKU`);
        continue;
      }
      const image = bySku.get(String(sku));
      if (!image || image === v.imageUrl) continue;

      changes.push({
        product: p.title.slice(0, 40),
        variant: v.title.slice(0, 28),
        from: v.imageUrl,
        to: image,
      });

      if (apply) {
        await prisma.variant.update({ where: { id: v.id }, data: { imageUrl: image } });
      }
    }
  }

  return NextResponse.json({
    applied: apply,
    productsChecked: checked,
    nextOffset: offset + products.length,
    variantsUpdated: changes.length,
    productsAffected: new Set(changes.map((c) => c.product)).size,
    unmatched: [...new Set(unmatched)].slice(0, 12),
    sample: changes.slice(0, 8).map((c) => `${c.product} / ${c.variant}`),
  });
}
