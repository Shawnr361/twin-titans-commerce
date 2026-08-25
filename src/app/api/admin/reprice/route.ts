import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditMargin, computePrice } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

/**
 * Re-price every variant against the current pricing rules.
 *
 * Changing the target margin only affects future imports; everything already
 * in the catalogue keeps the price it was given. This applies the change to
 * what is already live.
 *
 * A route rather than a script because node cannot start on this host — its
 * worker threads count against the LVE process cap and abort with
 * uv_thread_create. Inside the Passenger worker there is no process to spawn.
 *
 * Dry run unless `apply` is true. It rewrites what customers are charged, so
 * the default is to report and change nothing.
 */

const schema = z.object({
  apply: z.boolean().optional(),
  /** Omit to use the stored rules; pass a number to preview another margin. */
  marginPct: z.number().min(0).max(95).optional(),
  /** Include DRAFT products too. Default is live products only. */
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
  const { apply = false, marginPct, includeDrafts = false } = parsed.data;

  const [storedRules, settings] = await Promise.all([getPricingRules(), getStoreSettings()]);
  const rules = marginPct != null ? { ...storedRules, marginPct } : storedRules;
  const money = (minor: number) => formatMoney(minor, settings.baseCurrency);

  const products = await prisma.product.findMany({
    where: includeDrafts ? {} : { status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      status: true,
      variants: { select: { id: true, title: true, costMinor: true, priceMinor: true } },
    },
  });

  const changes: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  let variantsChanged = 0;

  for (const product of products) {
    for (const variant of product.variants) {
      /*
       * A variant with no recorded cost cannot be priced from a margin — the
       * result would be a number derived from zero. Those are reported and
       * left exactly as they are rather than silently repriced to nothing.
       */
      if (variant.costMinor <= 0) {
        skipped.push({
          product: product.title.slice(0, 48),
          variant: variant.title.slice(0, 32),
          reason: 'no landed cost recorded',
          price: money(variant.priceMinor),
        });
        continue;
      }

      const result = computePrice(variant.costMinor, rules);
      if (result.priceMinor === variant.priceMinor) continue;

      // Never write a price that does not clear cost, whatever the rules said.
      const audit = auditMargin(result.priceMinor, variant.costMinor, rules);
      if (audit.severity === 'loss') {
        skipped.push({
          product: product.title.slice(0, 48),
          variant: variant.title.slice(0, 32),
          reason: `would sell at or below landed cost (${audit.message})`,
          cost: money(variant.costMinor),
          wouldBe: money(result.priceMinor),
        });
        continue;
      }

      changes.push({
        product: product.title.slice(0, 48),
        variant: variant.title.slice(0, 32),
        cost: money(variant.costMinor),
        from: money(variant.priceMinor),
        to: money(result.priceMinor),
        marginPct: Number(result.marginPct.toFixed(1)),
      });

      if (apply) {
        await prisma.variant.update({
          where: { id: variant.id },
          data: { priceMinor: result.priceMinor, compareAtMinor: result.compareAtMinor },
        });
        variantsChanged++;
      }
    }
  }

  return NextResponse.json({
    applied: apply,
    targetMarginPct: rules.marginPct,
    minMarginPct: rules.minMarginPct,
    scope: includeDrafts ? 'all products' : 'live products only',
    productsScanned: products.length,
    variantsScanned: products.reduce((n, p) => n + p.variants.length, 0),
    variantsToChange: changes.length,
    variantsChanged,
    skipped,
    changes: changes.slice(0, 60),
    note: apply
      ? 'Prices updated.'
      : 'Nothing was changed. Send { "apply": true } to write these prices.',
  });
}
