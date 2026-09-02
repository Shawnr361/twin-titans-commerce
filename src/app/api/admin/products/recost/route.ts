import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { captureFromApi } from '@/lib/suppliers/aliexpress-fetch';
import { computePrice, supplierCostBasis } from '@/lib/pricing';
import { getPricingRules, getStoreSettings } from '@/lib/settings';
import { sourceCostToBase } from '@/lib/fx';

export const dynamic = 'force-dynamic';

/**
 * Re-cost the catalogue against what the supplier charges TODAY.
 *
 * WHY THIS RUN EXISTS
 * -------------------
 * Every product imported before supplierCostBasis was costed at the supplier's
 * "regular" price. Where that regular price is an anchor — a firming patch at
 * $44.85 nominal, $8.52 actual — the store marked up a number nobody has ever
 * paid and published it at ₦78,999. Those products are not merely dear, they
 * are unsellable, and ads pointed at them would spend money to prove it.
 *
 * DRY RUN BY DEFAULT
 * ------------------
 * This changes what customers are charged, across the whole catalogue, so
 * nothing is written unless the request says {"apply": true}. The preview shows
 * every before-and-after so a wrong rule is caught by eye rather than by a
 * customer.
 *
 * IT RE-COSTS, IT DOES NOT DISCOUNT
 * ---------------------------------
 * The new price is computed by the SAME pricing rules as an import — target
 * margin, minimum margin, gateway fees. This never sets a price directly, so it
 * cannot produce something below the floor the rules enforce.
 *
 * WHY SCALING, RATHER THAN MATCHING EACH VARIANT
 * ----------------------------------------------
 * Matching a stored variant to a supplier SKU needs supplierVariantId, and a
 * third of the catalogue predates its capture. But an AliExpress discount is a
 * single percentage across the listing, so the ratio between the old basis and
 * the correct one is the same for every variant. Each variant's own recorded
 * source cost is scaled by that one factor, which preserves the differences
 * between variants and needs no matching at all.
 *
 * Shipping is preserved exactly rather than re-derived: the converted shipping
 * portion is whatever the old landed cost had above the converted source cost,
 * so it survives a change in the FX rate since import.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  /** Stop after this many products, so a first look is quick and cheap. */
  limit: z.number().int().min(1).max(200).optional(),
  /*
   * Paging exists because each product costs one supplier lookup, and a hundred
   * of those outlives any sensible request timeout.
   */
  offset: z.number().int().min(0).optional(),
});

interface Change {
  handle: string;
  title: string;
  status: string;
  listUsd: number;
  promoUsd: number | null;
  discountPct: number;
  factor: number;
  before: { costMinor: number; priceMinor: number };
  after: { costMinor: number; priceMinor: number };
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
  const limit = (parsed.success && parsed.data.limit) || 200;
  const offset = (parsed.success && parsed.data.offset) || 0;

  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const products = await prisma.product.findMany({
    where: { source: { platform: 'ALIEXPRESS' } },
    select: {
      id: true,
      handle: true,
      title: true,
      status: true,
      source: { select: { externalId: true, sourceCurrency: true } },
      variants: {
        select: {
          id: true,
          costMinor: true,
          priceMinor: true,
          sourceCostMinor: true,
          sourceCostCurrency: true,
        },
      },
    },
    // A stable order, or paging would revisit and skip products at random.
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
  });

  const changes: Change[] = [];
  const skipped: string[] = [];
  let checked = 0;
  let alreadyCorrect = 0;

  for (const p of products) {
    const externalId = p.source?.externalId;
    if (!externalId) continue;
    checked++;

    let supplier;
    try {
      supplier = await captureFromApi(externalId, `https://www.aliexpress.com/item/${externalId}.html`);
    } catch {
      skipped.push(`${p.title.slice(0, 40)} — supplier lookup failed`);
      continue;
    }
    if (!supplier.capture || supplier.capture.variants.length === 0) {
      skipped.push(`${p.title.slice(0, 40)} — no supplier data`);
      continue;
    }

    const lists = supplier.capture.variants.map((v) => v.price).filter((n) => n > 0);
    const promos = supplier.capture.variants
      .map((v) => v.promoPrice)
      .filter((n): n is number => typeof n === 'number' && n > 0);
    if (lists.length === 0) {
      skipped.push(`${p.title.slice(0, 40)} — supplier quotes no price`);
      continue;
    }

    const list = Math.min(...lists);
    const promo = promos.length ? Math.min(...promos) : null;
    const basis = supplierCostBasis(list, promo);
    const factor = basis / list;

    // Nothing to do when the listing was never discounted into fiction.
    if (factor > 0.98) continue;

    const currency = p.source?.sourceCurrency ?? supplier.capture.currency;

    for (const v of p.variants) {
      const oldSource = v.sourceCostMinor ?? 0;
      if (oldSource <= 0) {
        skipped.push(`${p.title.slice(0, 34)} — a variant has no recorded source cost`);
        continue;
      }

      const { baseMinor: oldConverted } = await sourceCostToBase(
        oldSource,
        v.sourceCostCurrency ?? currency,
        settings.baseCurrency
      );
      /*
       * Whatever the old landed cost carried above the converted goods cost is
       * shipping. Carried across untouched so a rate change since import cannot
       * quietly alter it.
       */
      const shippingPortion = Math.max(0, v.costMinor - oldConverted);

      const newSource = Math.round(oldSource * factor);
      const { baseMinor: newConverted } = await sourceCostToBase(
        newSource,
        v.sourceCostCurrency ?? currency,
        settings.baseCurrency
      );
      const newLanded = newConverted + shippingPortion;
      const priced = computePrice(newLanded, rules);

      // Already re-costed on an earlier run: nothing to say and nothing to do.
      if (Math.abs(v.costMinor - newLanded) <= 1 && v.priceMinor === priced.priceMinor) {
        alreadyCorrect++;
        continue;
      }

      changes.push({
        handle: p.handle,
        title: p.title.slice(0, 46),
        status: p.status,
        listUsd: list,
        promoUsd: promo,
        discountPct: promo ? Math.round((1 - promo / list) * 100) : 0,
        factor: Number(factor.toFixed(3)),
        before: { costMinor: v.costMinor, priceMinor: v.priceMinor },
        after: { costMinor: newLanded, priceMinor: priced.priceMinor },
      });

      if (apply) {
        await prisma.variant.update({
          where: { id: v.id },
          data: {
            /*
             * sourceCostMinor is deliberately NOT written.
             *
             * It is the supplier's own listed figure at import — the historical
             * record this calculation starts from. Overwriting it would make a
             * second run scale an already-scaled number and halve every price
             * again. Leaving it alone makes the run idempotent: the same input
             * always produces the same output, so it is safe to re-run, safe to
             * run in pages, and safe if a request times out half way.
             */
            costMinor: newLanded,
            priceMinor: priced.priceMinor,
            compareAtMinor: priced.compareAtMinor ?? null,
          },
        });
      }
    }
  }

  const totalBefore = changes.reduce((n, c) => n + c.before.priceMinor, 0);
  const totalAfter = changes.reduce((n, c) => n + c.after.priceMinor, 0);

  return NextResponse.json({
    applied: apply,
    productsChecked: checked,
    nextOffset: offset + products.length,
    variantsAlreadyCorrect: alreadyCorrect,
    variantsChanged: changes.length,
    productsAffected: new Set(changes.map((c) => c.handle)).size,
    averagePriceDropPct:
      totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0,
    skipped: [...new Set(skipped)].slice(0, 20),
    changes: changes.slice(0, 60),
  });
}
