import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditMargin, computePrice } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

/**
 * Re-price one product, either to a target margin or to explicit prices.
 *
 * The bulk /api/admin/reprice route applies the store's default margin to
 * everything at once, which is the wrong tool for "this one item is priced
 * badly". Without a per-product control the only way to fix a single price was
 * to move the global default and re-price the whole catalogue.
 *
 * The same guard as everywhere else: nothing may be saved at or below landed
 * cost. That rule has caught a live per-unit loss three separate times, so it
 * is enforced here rather than trusted to the form.
 */

const schema = z.object({
  productId: z.string().min(1),
  /** Recompute every variant from its landed cost at this margin. */
  marginPct: z.number().min(0).max(95).optional(),
  /** Or set prices outright, in MINOR units, keyed by variant id. */
  prices: z.record(z.string(), z.number().int().min(0)).optional(),
  apply: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the values and try again.' }, { status: 400 });
  }
  const { productId, marginPct, prices, apply = false } = parsed.data;

  if (marginPct == null && !prices) {
    return NextResponse.json(
      { error: 'Give either a target margin or explicit prices.' },
      { status: 400 }
    );
  }

  const [storedRules, settings, product] = await Promise.all([
    getPricingRules(),
    getStoreSettings(),
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, variants: true },
    }),
  ]);
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const rules = marginPct != null ? { ...storedRules, marginPct } : storedRules;
  const money = (m: number) => formatMoney(m, settings.baseCurrency);

  const changes: Array<Record<string, unknown>> = [];
  const refused: Array<Record<string, unknown>> = [];

  for (const variant of product.variants) {
    let next: number | null = null;

    if (prices && prices[variant.id] != null) {
      next = prices[variant.id];
    } else if (marginPct != null) {
      /*
       * A variant with no recorded cost cannot be priced from a margin — the
       * result would be derived from zero. Reported, and left exactly as it is.
       */
      if (variant.costMinor <= 0) {
        refused.push({
          variant: variant.title,
          reason: 'no landed cost recorded',
          price: money(variant.priceMinor),
        });
        continue;
      }
      next = computePrice(variant.costMinor, rules).priceMinor;
    }

    if (next == null || next === variant.priceMinor) continue;

    const audit = auditMargin(next, variant.costMinor, rules);
    if (audit.severity === 'loss') {
      refused.push({
        variant: variant.title,
        reason: `would sell at or below landed cost (${audit.message})`,
        cost: money(variant.costMinor),
        wouldBe: money(next),
      });
      continue;
    }

    changes.push({
      variantId: variant.id,
      variant: variant.title,
      cost: money(variant.costMinor),
      from: money(variant.priceMinor),
      to: money(next),
      marginPct: Number(audit.marginPct.toFixed(1)),
    });

    if (apply) {
      await prisma.variant.update({
        where: { id: variant.id },
        data: { priceMinor: next },
      });
    }
  }

  return NextResponse.json({
    applied: apply,
    product: product.title,
    changed: apply ? changes.length : 0,
    changes,
    refused,
    note: apply ? 'Prices updated.' : 'Nothing was changed. Send apply:true to save.',
  });
}
