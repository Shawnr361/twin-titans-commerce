import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { call, isAliexpressConfigured } from '@/lib/suppliers/aliexpress-api';

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

/** "14:365458#Red;5:361386#XL" -> ["red", "xl"] */
function readableValues(skuAttr: string): string[] {
  return skuAttr
    .split(';')
    .map((part) => part.split('#')[1] ?? '')
    .map((v) => decodeURIComponent(v).trim().toLowerCase())
    .filter(Boolean);
}

function variantValues(optionValues: unknown): string[] {
  if (!optionValues || typeof optionValues !== 'object') return [];
  return Object.values(optionValues as Record<string, unknown>)
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter(Boolean);
}

/** Every {sku_id, sku_attr} pair anywhere in a nested reply. */
function collectSkus(body: unknown): { id: string; attr: string }[] {
  const found: { id: string; attr: string }[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const row = v as Record<string, unknown>;
    const id = row.sku_id ?? row.skuId;
    const attr = row.sku_attr ?? row.skuAttr ?? row.sku_property ?? '';
    if ((typeof id === 'string' || typeof id === 'number') && typeof attr === 'string') {
      found.push({ id: String(id), attr });
    }
    Object.values(row).forEach(walk);
  };
  walk(body);
  return found;
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

    let skus: { id: string; attr: string }[] = [];
    try {
      const res = await call('aliexpress.ds.product.get', {
        product_id: externalId,
        ship_to_country: 'NG',
        target_currency: 'USD',
        target_language: 'en',
      });
      skus = collectSkus(res.body);
      if (skus.length === 0) {
        apiProblems.push(`${product.title.slice(0, 40)}: no SKUs in the reply`);
        continue;
      }
    } catch (err) {
      apiProblems.push(
        `${product.title.slice(0, 40)}: ${err instanceof Error ? err.message : 'call failed'}`
      );
      continue;
    }

    for (const variant of product.variants) {
      const wanted = variantValues(variant.optionValues);
      if (wanted.length === 0) {
        unmatched.push(`${product.title.slice(0, 36)} — ${variant.title.slice(0, 22)} (no options)`);
        continue;
      }
      /*
       * Every stored option value must appear in the SKU's readable values.
       * A partial match is a guess, and a guessed SKU ships the wrong item.
       */
      const hit = skus.find((s) => {
        const have = readableValues(s.attr);
        return wanted.every((w) => have.includes(w));
      });
      if (hit) {
        matched.push({
          variantId: variant.id,
          sku: hit.id,
          label: `${product.title.slice(0, 36)} — ${variant.title.slice(0, 24)} -> ${hit.id}`,
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
