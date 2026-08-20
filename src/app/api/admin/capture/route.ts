import { NextResponse } from 'next/server';
import { assessCapture, captureSchema } from '@/lib/suppliers/capture';
import { prisma } from '@/lib/db';
import { captureToken } from '@/lib/suppliers/captureToken';
import { getSession } from '@/lib/auth';

/**
 * Receives a product captured by the in-page script.
 *
 * CROSS-ORIGIN BY NECESSITY: the script runs on aliexpress.com and posts here,
 * so this endpoint must answer CORS preflight and accept a foreign origin.
 * That makes it the one admin route not protected by the session cookie —
 * cookies are not sent cross-origin, and `credentials: 'include'` would demand
 * an origin allow-list we cannot know in advance.
 *
 * It is protected by a bearer token derived from AUTH_SECRET instead. The
 * token is only ever shown inside the authenticated admin, and the blast
 * radius if leaked is "a stranger can add a DRAFT product" — captures are inert
 * until a human prices and publishes them.
 */


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-capture-token',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  let expected: string;
  try {
    expected = captureToken();
  } catch {
    return NextResponse.json({ error: 'Store not configured.' }, { status: 503, headers: CORS });
  }

  /*
   * Two ways in, because supplier sites set a Content-Security-Policy whose
   * connect-src blocks the bookmarklet from posting here at all. When that
   * happens the script copies the payload to the clipboard and the merchant
   * pastes it into the admin — that request is same-origin and carries the
   * session cookie, so it needs no token.
   */
  const provided = request.headers.get('x-capture-token');
  const tokenOk = Boolean(provided) && provided === expected;
  const sessionOk = tokenOk ? false : Boolean(await getSession().catch(() => null));

  if (!tokenOk && !sessionOk) {
    return NextResponse.json(
      { error: 'Invalid capture token. Copy the bookmarklet again from your admin.' },
      { status: 401, headers: CORS }
    );
  }

  const parsed = captureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Capture did not match the expected shape: ${parsed.error.issues[0]?.message}` },
      { status: 422, headers: CORS }
    );
  }

  const capture = parsed.data;
  const quality = assessCapture(capture);

  try {
    const row = await prisma.supplierCapture.create({
      data: {
        platform: capture.platform,
        externalId: capture.externalId ?? null,
        sourceUrl: capture.sourceUrl,
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

    return NextResponse.json({ ok: true, id: row.id, quality }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not store the capture.' },
      { status: 500, headers: CORS }
    );
  }
}
