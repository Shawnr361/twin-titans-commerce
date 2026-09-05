import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { captureFromApi } from '@/lib/suppliers/aliexpress-fetch';

export const dynamic = 'force-dynamic';

/**
 * Recover the supplier SKU for variants that never captured one.
 *
 * Products imported by the bookmarklet before the SKU fix stored no
 * supplierVariantId, and without it automatic ordering refuses — correctly,
 * since AliExpress would otherwise pick a default variant and ship the wrong
 * colour. That refusal is what blocks a real customer order today: "sku none".
 *
 * The API knows every SKU on the listing. This matches ours to theirs and fills
 * the gap, which unblocks ordering without anyone re-capturing 36 products by
 * hand.
 *
 * MATCHED ON THE OPTION VALUES, NORMALISED
 * ----------------------------------------
 * "2pc-Pink" and "2PC PINK" are the same choice written twice; comparing them
 * literally would find nothing. Case, spaces and punctuation are stripped for
 * the comparison only — never written back, because the label a shopper reads
 * is not ours to rewrite here.
 *
 * A variant that matches nothing, or matches AMBIGUOUSLY, is left alone and
 * reported. Guessing would put a real SKU on the wrong colour, which is worse
 * than the blocked order it fixes: the order would sail through and the
 * customer would receive the wrong thing.
 *
 * SUPPLIER ORDER ITEMS ARE UPDATED TOO
 * ------------------------------------
 * A pending order holds its own copy of the SKU, taken when the order was
 * placed in the queue. Filling only the product would fix future orders and
 * leave the one a customer is waiting on still blocked.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/** Comparison key for an option set: order-independent, punctuation-blind. */
function optionKey(options: Record<string, unknown> | null | undefined): string {
  if (!options || typeof options !== 'object') return '';
  return Object.values(options)
    .map((v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .sort()
    .join('|');
}

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
    /*
     * EVERY AliExpress product, not just those missing a SKU outright.
     *
     * The original filter was `supplierVariantId: null`, which found two
     * products. The pricing sweep then turned up ~300 variants that DO carry a
     * SKU which no longer exists on the live listing — the supplier edited or
     * removed that option since import. Those are worse than a null: a
     * customer can buy them, and the order cannot be placed, because
     * AliExpress answers SKU_NOT_EXIST. Same failure that stalled order #20,
     * at a hundred times the scale, and invisible to a filter looking for
     * nulls.
     *
     * So the check is now "does this variant's SKU exist upstream", asked of
     * everything.
     */
    where: { source: { platform: 'ALIEXPRESS' } },
    select: {
      title: true,
      source: { select: { externalId: true } },
      variants: {
        select: { id: true, title: true, optionValues: true, supplierVariantId: true },
      },
    },
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
  });

  const filled: string[] = [];
  const unresolved: string[] = [];
  let checked = 0;
  let itemsUpdated = 0;
  /* Variants whose stored SKU had gone dead upstream. */
  let staleFixed = 0;
  /* Variants made unbuyable because they cannot be ordered. */
  let blocked = 0;

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
      unresolved.push(`${p.title.slice(0, 34)} — lookup failed`);
      continue;
    }
    if (!supplier.capture) continue;

    // Their SKUs, keyed the same way ours will be.
    const theirs = new Map<string, string[]>();
    for (const v of supplier.capture.variants) {
      if (!v.skuId) continue;
      const key = optionKey(v.options);
      theirs.set(key, [...(theirs.get(key) ?? []), String(v.skuId)]);
    }

    /*
     * A single-variant product has nothing to match ON, but also nothing to get
     * wrong: if the listing has exactly one SKU, it is that one.
     */
    const onlySku =
      supplier.capture.variants.length === 1 ? String(supplier.capture.variants[0].skuId ?? '') : '';

    /* The SKUs this listing actually has today. */
    const liveSkus = new Set(
      supplier.capture.variants.map((v) => String(v.skuId ?? '')).filter(Boolean)
    );

    for (const v of p.variants) {
      /*
       * Left alone only if its SKU is still real. A stored id that is no
       * longer on the listing is re-matched exactly like a missing one — it is
       * every bit as unorderable, it just looks fine in the database.
       */
      if (v.supplierVariantId && liveSkus.has(String(v.supplierVariantId))) continue;
      const wasStale = Boolean(v.supplierVariantId);

      const key = optionKey(v.optionValues as Record<string, unknown>);
      const candidates = theirs.get(key) ?? [];
      const sku =
        candidates.length === 1
          ? candidates[0]
          : p.variants.length === 1 && onlySku
            ? onlySku
            : '';

      if (!sku) {
        unresolved.push(
          `${p.title.slice(0, 30)} / ${v.title.slice(0, 22)} — ${
            candidates.length > 1 ? 'several SKUs match' : 'no SKU matches'
          }`
        );

        /*
         * Make it unbuyable, because it is unorderable.
         *
         * This variant cannot be placed with AliExpress — either the option is
         * gone from the listing, or several SKUs claim it and picking one would
         * risk shipping the wrong thing. Either way a customer can still add it
         * to a basket and pay, and the order then cannot be fulfilled. That is
         * order #20's failure exactly: money taken, nothing buyable.
         *
         * inventory = 0 is what the cart already enforces ("This variant is out
         * of stock", quantity clamped to zero), so it stops the sale without
         * touching the product, its other variants, or its price. It is one
         * edit to undo once the listing is re-imported.
         *
         * The whole PRODUCT is deliberately left alone. Measured before
         * choosing this: the Rosabeauty wig has 216 variants and 15 bad ones,
         * the mosquito lamp 2 and 1. Unpublishing on the strength of a dead
         * option would have taken 201 working wig variants and a live seller
         * off the shelf.
         */
        if (apply && v.supplierVariantId !== null) {
          await prisma.variant.update({ where: { id: v.id }, data: { inventory: 0 } });
          blocked++;
        }
        continue;
      }

      filled.push(
        `${wasStale ? 'restaled' : 'filled'}: ${p.title.slice(0, 30)} / ${v.title.slice(0, 20)}`
      );
      if (wasStale) staleFixed++;

      if (apply) {
        await prisma.variant.update({ where: { id: v.id }, data: { supplierVariantId: sku } });
        /*
         * The queued order carries its own copy of the SKU; fix that too or it
         * stays stuck on the old one.
         *
         * No longer restricted to null. A stale id needs replacing exactly
         * like a missing one, and the previous filter would have skipped every
         * stale case — leaving a queued order pointed at a SKU AliExpress
         * refuses with SKU_NOT_EXIST.
         *
         * PENDING only: a placed leg's reference records what was actually
         * bought, and rewriting it to match today's listing would make a real
         * purchase untraceable.
         */
        const res = await prisma.supplierOrderItem.updateMany({
          where: {
            orderLineItem: { variantId: v.id },
            supplierOrder: { status: 'PENDING' },
            NOT: { externalVariantId: sku },
          },
          data: { externalVariantId: sku },
        });
        itemsUpdated += res.count;
      }
    }
  }

  return NextResponse.json({
    applied: apply,
    productsChecked: checked,
    nextOffset: offset + products.length,
    variantsFilled: filled.length,
    staleSkusRepaired: staleFixed,
    unorderableVariantsBlocked: blocked,
    queuedOrderItemsFixed: itemsUpdated,
    unresolved: unresolved.slice(0, 15),
    sample: filled.slice(0, 10),
  });
}
