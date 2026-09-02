import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isAliexpressConfigured } from '@/lib/suppliers/aliexpress-api';
import { fetchSkus, matchSku, type SupplierSku } from '@/lib/suppliers/skuLookup';

export const dynamic = 'force-dynamic';

/**
 * Recover supplier SKUs from AliExpress itself, for products whose capture
 * cannot supply them.
 *
 * The capture backfill fixed everything whose original payload was still on
 * disk. What is left are products imported before captures were stored, or
 * whose captured options no longer match what is in the catalogue. Re-capturing
 * each by hand is an hour of clicking; the API already knows every SKU.
 *
 * MATCHED ON OPTION VALUES, NEVER ON POSITION
 * -------------------------------------------
 * Same rule as the capture backfill and for the same reason: a wrong SKU orders
 * a different colour and nobody finds out until the customer opens the parcel.
 * AliExpress returns sku_attr as "14:365458#Red;5:361386", where the readable
 * value is whatever follows the '#'. Those are compared against the variant's
 * stored option values; anything that does not match every value exactly is
 * left alone and reported.
 *
 * ONE PRODUCT PER CALL, AND A HARD CEILING
 * ----------------------------------------
 * This runs on shared hosting against a rate-limited API, so it walks a bounded
 * number of products per request and reports where it stopped. Better to run it
 * four times than to have one request time out half-applied.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  limit: z.number().int().min(1).max(40).optional(),
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

  if (!isAliexpressConfigured()) {
    return NextResponse.json({ error: 'AliExpress is not connected.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const apply = parsed.success ? Boolean(parsed.data.apply) : false;
  const limit = (parsed.success && parsed.data.limit) || 12;

  // Only products that still need it, and only those we can ask about.
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      variants: { some: { supplierVariantId: null } },
      source: { platform: 'ALIEXPRESS' },
    },
    select: {
      id: true,
      title: true,
      source: { select: { externalId: true } },
      variants: {
        where: { supplierVariantId: null },
        select: { id: true, title: true, optionValues: true },
      },
    },
    take: limit,
  });

  const matched: { variantId: string; sku: string; label: string }[] = [];
  const unmatched: string[] = [];
  const apiProblems: string[] = [];

  for (const product of products) {
    const externalId = product.source?.externalId;
    if (!externalId) continue;

    const skus: SupplierSku[] = await fetchSkus(externalId);
    if (skus.length === 0) {
      apiProblems.push(`${product.title.slice(0, 40)}: no SKUs came back`);
      continue;
    }

    for (const variant of product.variants) {
      const sku = matchSku(variant.optionValues, skus);
      if (sku) {
        matched.push({
          variantId: variant.id,
          sku,
          label: `${product.title.slice(0, 36)} — ${variant.title.slice(0, 24)} -> ${sku}`,
        });
      } else {
        unmatched.push(`${product.title.slice(0, 36)} — ${variant.title.slice(0, 24)}`);
      }
    }
  }

  if (!apply) {
    return NextResponse.json({
      applied: false,
      productsExamined: products.length,
      wouldFill: matched.length,
      noMatch: unmatched.length,
      examples: matched.slice(0, 8).map((m) => m.label),
      unmatchedExamples: unmatched.slice(0, 8),
      apiProblems: apiProblems.slice(0, 8),
    });
  }

  let filled = 0;
  const failures: string[] = [];
  for (const m of matched) {
    try {
      await prisma.variant.update({
        where: { id: m.variantId },
        data: { supplierVariantId: m.sku },
      });
      filled++;
    } catch (err) {
      failures.push(`${m.label}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  return NextResponse.json({
    applied: true,
    productsExamined: products.length,
    filled,
    noMatch: unmatched.length,
    apiProblems: apiProblems.slice(0, 8),
    failures,
  });
}
