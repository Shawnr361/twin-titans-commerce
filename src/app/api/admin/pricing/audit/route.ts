import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sourceCostToBase } from '@/lib/fx';
import { computePrice } from '@/lib/pricing';
import { getPricingRules, getStoreSettings } from '@/lib/settings';
import { captureFromApi } from '@/lib/suppliers/aliexpress-fetch';
import { freightFor, shippingOnLine } from '@/lib/suppliers/aliexpress-freight';

export const dynamic = 'force-dynamic';

/**
 * What every live variant TRULY costs today, against what we charge for it.
 *
 * WHY THE EXISTING MARGIN AUDIT COULD NOT ANSWER THIS
 * ---------------------------------------------------
 * /admin/margins compares the selling price to the STORED landed cost, and
 * that stored number carries three faults at once:
 *
 *   1. No delivery. captureFromApi never set shippingCost, so every
 *      API-imported product was costed at the item price alone — $1.99 missing
 *      on a $4.20 lip gloss.
 *   2. Frozen FX. The cost was converted at the rate on the day it was
 *      imported and never revisited. One stored cost works out at
 *      NGN699.60/USD against a live rate of NGN1,324.50 — half.
 *   3. A derived basis. supplierCostBasis takes min(sku_price, promo x 1.2),
 *      which returned $5.04 where AliExpress actually billed $4.20. The field
 *      that matches the invoice is offer_sale_price, verified against order
 *      3076322850022701.
 *
 * All three live inside the number the margin page trusts, which is why it
 * reports 0 of 500 variants selling at a loss with complete confidence. This
 * route recomputes from live supplier price, live freight and today's rate,
 * so a loss is discovered here rather than in the bank balance.
 *
 * DRY RUN BY DEFAULT
 * ------------------
 * With {"apply": true} it rewrites prices through the SAME pricing rules an
 * import uses, so nothing can land below the configured floor. Without it,
 * nothing is written at all. This changes what customers are charged across
 * the catalogue; it gets looked at before it gets applied.
 *
 * PAGED, BECAUSE EACH PRODUCT COSTS TWO SUPPLIER CALLS
 * ----------------------------------------------------
 * One product.get plus one freight.query each. A hundred of those outlives any
 * sensible request timeout, so `limit` and `offset` walk the catalogue and the
 * caller stitches the pages together.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional(),
  /** Where the customer is. Delivery cost is per destination. */
  country: z.string().length(2).optional(),
});

interface Row {
  product: string;
  variant: string;
  /** Supplier price actually billed, in supplier currency. */
  itemUsd: number;
  shippingUsd: number | null;
  landedMinor: number;
  storedLandedMinor: number;
  priceMinor: number;
  profitMinor: number;
  marginPct: number;
  suggestedPriceMinor: number;
  verdict: 'loss' | 'below-floor' | 'ok';
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
  const country = (parsed.success && parsed.data.country) || 'NG';

  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', source: { platform: 'ALIEXPRESS' } },
    select: {
      id: true,
      title: true,
      source: { select: { externalId: true } },
      variants: {
        select: {
          id: true,
          title: true,
          priceMinor: true,
          costMinor: true,
          supplierVariantId: true,
        },
      },
    },
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
  });

  const rows: Row[] = [];
  const skipped: string[] = [];
  const unknownShipping: string[] = [];
  let repriced = 0;

  for (const product of products) {
    const externalId = product.source?.externalId;
    if (!externalId) continue;

    let supplier;
    try {
      supplier = await captureFromApi(externalId, `https://www.aliexpress.com/item/${externalId}.html`);
    } catch {
      skipped.push(`${product.title.slice(0, 40)} — supplier lookup failed`);
      continue;
    }
    if (!supplier.capture) {
      skipped.push(`${product.title.slice(0, 40)} — no data returned`);
      continue;
    }

    /* Their SKUs by id, so a variant is matched rather than guessed at. */
    const bySku = new Map<string, { price: number; promo?: number | null }>();
    for (const v of supplier.capture.variants) {
      if (v.skuId) bySku.set(String(v.skuId), { price: v.price ?? 0, promo: v.promoPrice });
    }

    for (const variant of product.variants) {
      const sku = variant.supplierVariantId ? bySku.get(String(variant.supplierVariantId)) : null;
      if (!sku) {
        skipped.push(`${product.title.slice(0, 30)} / ${variant.title.slice(0, 20)} — no SKU match`);
        continue;
      }

      /*
       * offer_sale_price — mapped to promoPrice on the way in — is what the
       * account is billed. sku_price is the anchor AliExpress shows struck
       * through, and costing against it is what made the catalogue look
       * profitable on paper.
       */
      const itemUsd = sku.promo && sku.promo > 0 ? sku.promo : sku.price;
      if (!itemUsd) {
        skipped.push(`${product.title.slice(0, 30)} / ${variant.title.slice(0, 20)} — no price`);
        continue;
      }

      /*
       * Freight is quoted PER SKU, because the API requires selectedSkuId and
       * because a heavy variant does not ship for the price of a light one.
       */
      const quote = await freightFor(externalId, String(variant.supplierVariantId), country);
      const shippingUsd = shippingOnLine(quote, itemUsd);

      /*
       * Unknown shipping is never treated as free.
       *
       * That substitution is what made the first run of this audit report a
       * clean catalogue: every freight call had failed, and `?? 0` turned each
       * silence into free delivery. A row we cannot cost is reported as
       * uncosted, and is never re-priced on a number we do not have.
       */
      if (shippingUsd === null) {
        unknownShipping.push(`${product.title.slice(0, 34)} / ${variant.title.slice(0, 18)}`);
        continue;
      }

      const sourceTotal = itemUsd + shippingUsd;

      const { baseMinor: landedMinor, converted } = await sourceCostToBase(
        Math.round(sourceTotal * 100),
        supplier.capture.currency || 'USD',
        settings.baseCurrency
      );
      if (!converted) {
        skipped.push(`${product.title.slice(0, 30)} — no exchange rate`);
        continue;
      }

      const solved = computePrice(landedMinor, rules);
      const profitMinor = variant.priceMinor - landedMinor;
      const marginPct = variant.priceMinor > 0 ? (profitMinor / variant.priceMinor) * 100 : 0;

      const verdict: Row['verdict'] =
        profitMinor <= 0 ? 'loss' : marginPct < rules.minMarginPct ? 'below-floor' : 'ok';

      rows.push({
        product: product.title.slice(0, 46),
        variant: variant.title.slice(0, 26),
        itemUsd,
        shippingUsd,
        landedMinor,
        storedLandedMinor: variant.costMinor,
        priceMinor: variant.priceMinor,
        profitMinor,
        marginPct: Math.round(marginPct * 10) / 10,
        suggestedPriceMinor: solved.priceMinor,
        verdict,
      });

      /*
       * Only what is actually underwater is touched. Re-pricing a healthy
       * variant would churn the storefront for nothing and lose deliberate
       * manual prices along the way.
       */
      if (apply && verdict !== 'ok') {
        await prisma.variant.update({
          where: { id: variant.id },
          data: { priceMinor: solved.priceMinor, costMinor: landedMinor },
        });
        repriced++;
      } else if (apply) {
        // Cost is refreshed even when the price stands, so the margin page stops lying.
        await prisma.variant.update({
          where: { id: variant.id },
          data: { costMinor: landedMinor },
        });
      }
    }
  }

  const losses = rows.filter((r) => r.verdict === 'loss');
  const below = rows.filter((r) => r.verdict === 'below-floor');

  return NextResponse.json({
    applied: apply,
    country,
    productsChecked: products.length,
    nextOffset: offset + products.length,
    variantsChecked: rows.length,
    sellingAtALoss: losses.length,
    belowFloor: below.length,
    repriced,
    variantsPayingShipping: rows.filter((r) => (r.shippingUsd ?? 0) > 0).length,
    shippingUnknown: unknownShipping.length,
    shippingUnknownExamples: unknownShipping.slice(0, 8),
    worst: [...losses, ...below]
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 15)
      .map(
        (r) =>
          `${r.product} / ${r.variant}: item $${r.itemUsd} + ship $${r.shippingUsd ?? '?'} → ` +
          `landed ${r.landedMinor} vs stored ${r.storedLandedMinor}, price ${r.priceMinor}, ` +
          `margin ${r.marginPct}% → suggest ${r.suggestedPriceMinor}`
      ),
    skipped: skipped.slice(0, 12),
  });
}
