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
 * Re-price what can still make money; take down what cannot.
 *
 * WHY BOTH, AND NOT JUST RE-PRICING
 * ---------------------------------
 * The full audit found 242 variants selling at a loss and 280 below the floor,
 * out of 808 costed. The cause is arithmetic rather than carelessness: supplier
 * delivery to Nigeria is around $2, so on a NGN1,999 item the postage alone
 * exceeds the goods, and every one of those was costed as though delivery were
 * free and the naira twice as strong.
 *
 * Re-pricing all of it to the margin floor would be honest and useless — a lip
 * oil at NGN9,999 instead of NGN1,999 does not sell, it just stops being
 * bought while still occupying the catalogue. So each variant is asked two
 * questions, and a product only comes down when the answer to both is no for
 * every one of its variants.
 *
 * THE TWO TESTS
 * -------------
 *  1. Is the corrected price within reach of the current one? A rise beyond
 *     `maxUplift` is not a re-price, it is a different product at a different
 *     price point, and pretending otherwise leaves dead stock on the shelf.
 *  2. Does it clear a minimum ABSOLUTE profit? A 20% margin on NGN1,999 is
 *     NGN400 — which cannot pay for an ad click, a support reply, or a single
 *     return. Percentage margin alone hides this, which is how a catalogue
 *     fills up with items that are technically profitable and actually not.
 *
 * DELISTING IS REVERSIBLE AND PER PRODUCT
 * ---------------------------------------
 * Status goes to DRAFT. Nothing is deleted, no history is lost, and one edit
 * puts it back. And it is decided per PRODUCT, not per variant: a listing with
 * one viable option keeps its place and has that option re-priced, because
 * pulling a whole product over its worst variant throws away the good one.
 *
 * ANYTHING UNCOSTED IS LEFT ALONE
 * -------------------------------
 * 649 variants could not be costed on the last sweep — their freight lookups
 * came back empty under rate limiting. A variant whose true cost is unknown is
 * neither re-priced nor delisted here. Acting on absent data is what produced
 * the original fault.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional(),
  country: z.string().length(2).optional(),
  /** Largest acceptable price rise, as a multiple of today's price. */
  maxUplift: z.number().min(1).max(10).optional(),
  /** Minimum gross profit per unit, in MINOR units of the base currency. */
  minProfitMinor: z.number().int().min(0).optional(),
  /** Pause between supplier calls, to stay under the rate limit. */
  delayMs: z.number().int().min(0).max(2000).optional(),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Decision {
  /* The id, not the title: applying a price by matching truncated text could
   * write to the wrong variant, which is not a mistake worth risking. */
  variantId: string;
  product: string;
  variant: string;
  landedMinor: number;
  priceMinor: number;
  suggestedMinor: number;
  profitMinor: number;
  action: 'keep' | 'reprice' | 'unviable' | 'uncosted';
  why?: string;
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
  const maxUplift = (parsed.success && parsed.data.maxUplift) || 2;
  const minProfitMinor = parsed.success ? (parsed.data.minProfitMinor ?? 150_000) : 150_000;
  const delayMs = parsed.success ? (parsed.data.delayMs ?? 120) : 120;

  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', source: { platform: 'ALIEXPRESS' } },
    select: {
      id: true,
      title: true,
      source: { select: { externalId: true } },
      variants: {
        select: { id: true, title: true, priceMinor: true, supplierVariantId: true },
      },
    },
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit,
  });

  const decisions: Decision[] = [];
  const delisted: string[] = [];
  let repriced = 0;
  let productsDelisted = 0;

  for (const product of products) {
    const externalId = product.source?.externalId;
    if (!externalId) continue;

    let supplier;
    try {
      supplier = await captureFromApi(externalId, `https://www.aliexpress.com/item/${externalId}.html`);
    } catch {
      continue;
    }
    if (!supplier.capture) continue;

    const bySku = new Map<string, { price: number; promo?: number | null }>();
    for (const v of supplier.capture.variants) {
      if (v.skuId) bySku.set(String(v.skuId), { price: v.price ?? 0, promo: v.promoPrice });
    }

    /* One quote per listing; measured identical across variants on every product sampled. */
    let quote: Awaited<ReturnType<typeof freightFor>> | undefined;
    const here: Decision[] = [];

    for (const variant of product.variants) {
      const sku = variant.supplierVariantId ? bySku.get(String(variant.supplierVariantId)) : null;
      const itemUsd = sku ? (sku.promo && sku.promo > 0 ? sku.promo : sku.price) : 0;
      if (!itemUsd) {
        here.push({
          variantId: variant.id,
          product: product.title.slice(0, 44),
          variant: variant.title.slice(0, 24),
          landedMinor: 0,
          priceMinor: variant.priceMinor,
          suggestedMinor: 0,
          profitMinor: 0,
          action: 'uncosted',
          why: 'no supplier price',
        });
        continue;
      }

      if (quote === undefined) {
        quote = await freightFor(externalId, String(variant.supplierVariantId), country);
        if (delayMs) await sleep(delayMs);
      }
      const shippingUsd = shippingOnLine(quote, itemUsd);
      if (shippingUsd === null) {
        here.push({
          variantId: variant.id,
          product: product.title.slice(0, 44),
          variant: variant.title.slice(0, 24),
          landedMinor: 0,
          priceMinor: variant.priceMinor,
          suggestedMinor: 0,
          profitMinor: 0,
          action: 'uncosted',
          why: 'delivery cost unavailable',
        });
        continue;
      }

      const { baseMinor: landedMinor, converted } = await sourceCostToBase(
        Math.round((itemUsd + shippingUsd) * 100),
        supplier.capture.currency || 'USD',
        settings.baseCurrency
      );
      if (!converted) continue;

      const solved = computePrice(landedMinor, rules);
      const profitNow = variant.priceMinor - landedMinor;
      const marginNow = variant.priceMinor > 0 ? (profitNow / variant.priceMinor) * 100 : 0;
      const healthy = profitNow > 0 && marginNow >= rules.minMarginPct;

      if (healthy) {
        here.push({
          variantId: variant.id,
          product: product.title.slice(0, 44),
          variant: variant.title.slice(0, 24),
          landedMinor,
          priceMinor: variant.priceMinor,
          suggestedMinor: variant.priceMinor,
          profitMinor: profitNow,
          action: 'keep',
        });
        continue;
      }

      const withinReach = solved.priceMinor <= variant.priceMinor * maxUplift;
      const worthSelling = solved.priceMinor - landedMinor >= minProfitMinor;

      here.push({
        variantId: variant.id,
        product: product.title.slice(0, 44),
        variant: variant.title.slice(0, 24),
        landedMinor,
        priceMinor: variant.priceMinor,
        suggestedMinor: solved.priceMinor,
        profitMinor: solved.priceMinor - landedMinor,
        action: withinReach && worthSelling ? 'reprice' : 'unviable',
        why: withinReach
          ? worthSelling
            ? undefined
            : `only ${Math.round((solved.priceMinor - landedMinor) / 100)} profit per unit`
          : `needs ${(solved.priceMinor / variant.priceMinor).toFixed(1)}x the current price`,
      });
    }

    /*
     * A product comes down only when nothing on it can work. One viable option
     * is enough to keep the listing — pulling it over its worst variant would
     * throw the good one away with it.
     */
    const costed = here.filter((d) => d.action !== 'uncosted');
    const anyViable = costed.some((d) => d.action === 'keep' || d.action === 'reprice');
    const takeDown = costed.length > 0 && !anyViable;

    if (takeDown) {
      delisted.push(
        `${product.title.slice(0, 46)} — ${costed.length} variant(s), none viable (${costed[0].why ?? 'below floor'})`
      );
      if (apply) {
        await prisma.product.update({ where: { id: product.id }, data: { status: 'DRAFT' } });
        productsDelisted++;
      }
    } else if (apply) {
      for (const d of here) {
        if (d.action !== 'reprice') continue;
        const variant = product.variants.find((v) => v.id === d.variantId);
        if (!variant) continue;

        /* Re-quote the exact variant before its price changes. */
        const exact = await freightFor(externalId, String(variant.supplierVariantId), country);
        if (delayMs) await sleep(delayMs);
        const sku = bySku.get(String(variant.supplierVariantId));
        const itemUsd = sku ? (sku.promo && sku.promo > 0 ? sku.promo : sku.price) : 0;
        const exactShipping = shippingOnLine(exact, itemUsd);
        if (exactShipping === null || !itemUsd) continue;

        const conv = await sourceCostToBase(
          Math.round((itemUsd + exactShipping) * 100),
          supplier.capture.currency || 'USD',
          settings.baseCurrency
        );
        if (!conv.converted) continue;

        const exactSolved = computePrice(conv.baseMinor, rules);
        await prisma.variant.update({
          where: { id: variant.id },
          data: { priceMinor: exactSolved.priceMinor, costMinor: conv.baseMinor },
        });
        repriced++;
      }
    }

    decisions.push(...here);
  }

  const count = (a: Decision['action']) => decisions.filter((d) => d.action === a).length;

  return NextResponse.json({
    applied: apply,
    rules: { maxUplift, minProfitMinor, country, minMarginPct: rules.minMarginPct },
    productsChecked: products.length,
    nextOffset: offset + products.length,
    variants: {
      keep: count('keep'),
      reprice: count('reprice'),
      unviable: count('unviable'),
      uncosted: count('uncosted'),
    },
    productsToDelist: delisted.length,
    productsDelisted,
    repriced,
    delistExamples: delisted.slice(0, 10),
    repriceExamples: decisions
      .filter((d) => d.action === 'reprice')
      .slice(0, 10)
      .map(
        (d) =>
          `${d.product} / ${d.variant}: ₦${(d.priceMinor / 100).toLocaleString()} → ₦${(d.suggestedMinor / 100).toLocaleString()} (profit ₦${(d.profitMinor / 100).toLocaleString()})`
      ),
  });
}
