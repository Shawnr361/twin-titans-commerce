import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assessCapture, captureSchema } from '@/lib/suppliers/capture';
import { parseSupplierUrl } from '@/lib/suppliers/parse';
import { captureFromApi } from '@/lib/suppliers/aliexpress-fetch';
import { isAliexpressConfigured } from '@/lib/suppliers/aliexpress-api';

export const dynamic = 'force-dynamic';

/**
 * Import a product from a link, with no browser extension and no scraping.
 *
 * Paste an AliExpress URL — or just the product id — and the server asks the
 * API for the title, images, variants, prices and SKUs, then stores the result
 * as an ordinary capture. From there it is indistinguishable from a bookmarklet
 * capture: the same preview, the same pricing, the same quality gate, the same
 * importer.
 *
 * WHY IT STOPS AT A CAPTURE
 * -------------------------
 * It does not create the product. Every import still passes a human who sets
 * the price, because a catalogue that publishes itself is how a loss-making
 * variant reaches the storefront. This removes the fiddly part — getting the
 * data in — and leaves the decision.
 *
 * DUPLICATES ARE REPORTED, NOT REFUSED
 * ------------------------------------
 * Same rule as the bookmarklet: re-fetching to refresh prices is legitimate, so
 * an existing product is named in the reply and the caller decides.
 */
const schema = z.object({ url: z.string().min(4) });

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
    return NextResponse.json(
      { error: 'AliExpress is not connected, so a link cannot be looked up.' },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paste an AliExpress link or product id.' }, { status: 400 });
  }

  const input = parsed.data.url.trim();

  /*
   * A bare id is accepted as well as a URL. Merchants copy both, and refusing
   * one of them is a papercut with no upside.
   */
  let productId: string | null = /^\d{6,}$/.test(input) ? input : null;
  let sourceUrl = productId ? `https://www.aliexpress.com/item/${productId}.html` : input;

  if (!productId) {
    const link = parseSupplierUrl(input);
    if (!link || link.platform !== 'ALIEXPRESS' || !link.externalId) {
      return NextResponse.json(
        { error: 'That does not look like an AliExpress product link.' },
        { status: 422 }
      );
    }
    productId = link.externalId;
    sourceUrl = link.canonicalUrl;
  }

  // Already in the store? Say so before anything else.
  const existing = await prisma.supplierProduct
    .findFirst({
      where: { platform: 'ALIEXPRESS', externalId: productId },
      select: { product: { select: { title: true, handle: true, status: true } } },
    })
    .catch(() => null);

  let result;
  try {
    result = await captureFromApi(productId, sourceUrl);
  } catch (err) {
    return NextResponse.json(
      { error: `AliExpress refused the lookup: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502 }
    );
  }

  if (!result.capture) {
    return NextResponse.json({ error: result.problems.join(' ') }, { status: 502 });
  }

  // Through the same gate a browser capture passes, so nothing skips validation.
  const validated = captureSchema.safeParse(result.capture);
  if (!validated.success) {
    return NextResponse.json(
      { error: `The reply did not fit a capture: ${validated.error.issues[0]?.message}` },
      { status: 502 }
    );
  }

  const capture = validated.data;
  const quality = assessCapture(capture);

  const row = await prisma.supplierCapture.create({
    data: {
      platform: 'ALIEXPRESS',
      externalId: productId,
      sourceUrl,
      title: capture.title.slice(0, 500),
      currency: capture.currency,
      payload: capture as never,
      variantCount: quality.variantCount,
      pricedVariantCount: quality.pricedVariantCount,
      imageCount: quality.imageCount,
      videoCount: quality.videoCount,
      reviewCount: quality.reviewCount,
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    title: capture.title,
    quality,
    problems: result.problems,
    duplicateOf: existing?.product ?? null,
    ...(existing?.product
      ? {
          warning: `Already in the store as "${existing.product.title.slice(0, 60)}" (${existing.product.status.toLowerCase()}). Fetched anyway — use it to refresh, not to publish a second copy.`,
        }
      : {}),
  });
}
