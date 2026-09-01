import { NextResponse } from 'next/server';
import { assessCapture, captureSchema } from '@/lib/suppliers/capture';
import { prisma } from '@/lib/db';
import { captureToken } from '@/lib/suppliers/captureToken';
import { getSession } from '@/lib/auth';
import { listCaptureRows } from '@/lib/suppliers/captureRows';

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

/**
 * Cheap poll target for the import page.
 *
 * A capture arrives from a different tab entirely - the supplier's page - so
 * nothing in this app knows to re-render when one lands, and the merchant had
 * to reload by hand. The page polls this and refreshes only when the answer
 * changes. Deliberately a count plus a timestamp rather than the rows: it runs
 * every few seconds on shared hosting, so it has to stay tiny.
 */
export async function GET(request: Request) {
  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const [count, latest] = await Promise.all([
    prisma.supplierCapture.count(),
    prisma.supplierCapture.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    }),
  ]);

  // The steady-state poll asks only "has anything changed?". The rows are
  // fetched once, afterwards, when the answer is yes - so the every-few-seconds
  // request stays two numbers rather than 25 rows of payload.
  const wantRows = new URL(request.url).searchParams.get('rows') === '1';

  return NextResponse.json({
    count,
    latestId: latest?.id ?? null,
    latestAt: latest?.createdAt.toISOString() ?? null,
    captures: wantRows ? await listCaptureRows() : undefined,
  });
}

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

  /*
   * Is this already in the store?
   *
   * Captured before the answer is saved, because the useful moment to say so is
   * while the merchant is still on the supplier's page — not after a duplicate
   * has been priced, imported and published a second time. The capture is still
   * stored either way: re-capturing to refresh prices or images is legitimate,
   * so this warns rather than refuses.
   *
   * Matched on (platform, externalId), the same uniquely-indexed pair the
   * capture list uses to recover its links, so it cannot be fooled by a URL
   * that carries different tracking parameters than last time.
   */
  let duplicateOf: { title: string; handle: string; status: string } | null = null;
  if (capture.externalId) {
    const existing = await prisma.supplierProduct
      .findFirst({
        where: { platform: capture.platform, externalId: capture.externalId },
        select: { product: { select: { title: true, handle: true, status: true } } },
      })
      .catch(() => null);
    if (existing?.product) {
      duplicateOf = {
        title: existing.product.title,
        handle: existing.product.handle,
        status: existing.product.status,
      };
    }
  }

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

    return NextResponse.json(
      {
        ok: true,
        id: row.id,
        quality,
        duplicateOf,
        ...(duplicateOf
          ? {
              warning: `Already in the store as "${duplicateOf.title.slice(0, 60)}" (${duplicateOf.status.toLowerCase()}). Saved anyway — import it only if you meant to replace that one.`,
            }
          : {}),
      },
      { headers: CORS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not store the capture.' },
      { status: 500, headers: CORS }
    );
  }
}
