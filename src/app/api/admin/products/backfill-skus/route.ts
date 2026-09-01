import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Put the supplier SKU back on variants that were imported without one.
 *
 * WHY ANY OF THEM ARE MISSING
 * ---------------------------
 * fromCapture built each variant as a plain object literal returned from
 * .map(), writing the SKU to `supplierVariantId` — a field that does not exist
 * on NormalizedVariant. Every field on that type is optional, so the object was
 * still assignable and the build stayed green while the id went nowhere. The
 * importer then read `externalVariantId`, found undefined, and wrote null.
 *
 * The consequence was invisible until automatic ordering existed: placeWithSupplier
 * refuses any line without a SKU rather than let AliExpress pick a default
 * variant and ship the wrong colour. With every variant null, it refused
 * everything.
 *
 * NOTHING NEEDS RE-CAPTURING
 * --------------------------
 * The ids were never lost, only misfiled — SupplierCapture.payload still holds
 * the original skuId for every variant, and each capture records the product it
 * became. This re-matches the two by their option values.
 *
 * MATCHED ON OPTIONS, NEVER ON POSITION
 * -------------------------------------
 * Index order looks tempting and is wrong: padding variants have since been
 * deleted, so row 3 today is not row 3 as captured. A wrong SKU is far worse
 * than a missing one — it silently orders a different colour and the mistake
 * only surfaces when the customer opens the parcel. Anything that does not
 * match exactly on its options is left alone and reported.
 */
const schema = z.object({ apply: z.boolean().optional() });

interface CapturedVariant {
  options?: Record<string, string>;
  skuId?: string;
}

/** Option maps compared independent of key order and surrounding space. */
function optionKey(options: unknown): string {
  if (!options || typeof options !== 'object') return '';
  return Object.entries(options as Record<string, unknown>)
    .map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim().toLowerCase()])
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
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

  /*
   * Both ways of finding the product a capture became.
   *
   * importedProductId is only written on captures taken after that link was
   * added — six of sixty-four here. The rest are recovered the way the capture
   * list already recovers them: SupplierProduct and SupplierCapture both carry
   * (platform, externalId) and SupplierProduct is uniquely indexed on exactly
   * that pair, so the match is precise rather than string-matching on URLs.
   */
  const captures = await prisma.supplierCapture.findMany({
    select: {
      importedProductId: true,
      platform: true,
      externalId: true,
      payload: true,
      title: true,
    },
  });

  const needLink = captures.filter((c) => !c.importedProductId && c.externalId);
  const links = needLink.length
    ? await prisma.supplierProduct
        .findMany({
          where: {
            OR: needLink.map((c) => ({
              platform: c.platform,
              externalId: c.externalId as string,
            })),
          },
          select: { productId: true, platform: true, externalId: true },
        })
        .catch(() => [])
    : [];
  const linkOf = new Map(links.map((l) => [`${l.platform}:${l.externalId}`, l.productId]));

  const resolve = (c: (typeof captures)[number]): string | null =>
    c.importedProductId ?? linkOf.get(`${c.platform}:${c.externalId}`) ?? null;

  const matched: { variantId: string; sku: string; product: string; option: string }[] = [];
  const unmatched: string[] = [];
  let productsSeen = 0;

  for (const capture of captures) {
    const productId = resolve(capture);
    if (!productId) continue;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        title: true,
        variants: { select: { id: true, title: true, optionValues: true, supplierVariantId: true } },
      },
    });
    if (!product) continue;
    productsSeen++;

    const payload = capture.payload as { variants?: CapturedVariant[] } | null;
    const bySku = new Map<string, string>();
    for (const v of payload?.variants ?? []) {
      const key = optionKey(v.options);
      // A capture can list the same option set twice; the first id wins rather
      // than a later duplicate silently overwriting it.
      if (v.skuId && key && !bySku.has(key)) bySku.set(key, v.skuId);
    }

    for (const variant of product.variants) {
      if (variant.supplierVariantId) continue;
      const sku = bySku.get(optionKey(variant.optionValues));
      if (sku) {
        matched.push({
          variantId: variant.id,
          sku,
          product: product.title.slice(0, 44),
          option: variant.title.slice(0, 30),
        });
      } else {
        unmatched.push(`${product.title.slice(0, 40)} — ${variant.title.slice(0, 24)}`);
      }
    }
  }

  if (!apply) {
    return NextResponse.json({
      applied: false,
      captures: captures.length,
      capturesResolvedToAProduct: captures.filter((c) => resolve(c)).length,
      productsChecked: productsSeen,
      wouldFill: matched.length,
      noMatchInCapture: unmatched.length,
      examples: matched.slice(0, 8).map((m) => `${m.product} — ${m.option} -> ${m.sku}`),
      unmatchedExamples: unmatched.slice(0, 8),
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
      failures.push(`${m.product}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  return NextResponse.json({
    applied: true,
    productsChecked: productsSeen,
    filled,
    noMatchInCapture: unmatched.length,
    failures,
  });
}
