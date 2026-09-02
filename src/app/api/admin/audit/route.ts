import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { isMailConfigured } from '@/lib/mail';
import { isAliexpressConfigured, storedToken } from '@/lib/suppliers/aliexpress-api';

export const dynamic = 'force-dynamic';

/**
 * A read-only sweep of the whole store, looking for what is broken, unsellable
 * or about to cost money.
 *
 * WRITES NOTHING. Every check is a count and a handful of examples, so it is
 * safe to run at any time, including while orders are coming in.
 *
 * Ordered by what actually hurts: money first (a variant priced below cost
 * loses on every sale), then anything that stops a customer buying, then
 * fulfilment, then things that are merely untidy. A list that opens with
 * cosmetics teaches you to ignore it.
 */

type Severity = 'critical' | 'warning' | 'info';

interface Finding {
  id: string;
  severity: Severity;
  title: string;
  count: number;
  /** What it costs if ignored, and what fixing it means. */
  detail: string;
  examples: string[];
}

const DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const settings = await getStoreSettings();
  const findings: Finding[] = [];
  const add = (f: Finding) => {
    if (f.count > 0) findings.push(f);
  };

  const [products, orders, supplierOrders, rates, captures] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        handle: true,
        status: true,
        descriptionHtml: true,
        images: { select: { id: true } },
        collections: { select: { collectionId: true } },
        variants: {
          select: {
            id: true,
            title: true,
            priceMinor: true,
            costMinor: true,
            compareAtMinor: true,
            supplierVariantId: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      select: {
        id: true,
        number: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
        supplierOrders: { select: { id: true } },
      },
    }),
    prisma.supplierOrder.findMany({
      select: {
        id: true,
        status: true,
        placedAt: true,
        createdAt: true,
        trackingNumber: true,
        externalOrderNo: true,
        order: { select: { number: true } },
      },
    }),
    prisma.fxRate.findMany({ select: { code: true, rate: true, updatedAt: true } }),
    /*
     * NOT a count of importedProductId: null.
     *
     * That link is only written on captures taken after it was added, so
     * counting nulls reported 58 captures "never imported" when 56 of them are
     * live products already. The honest test is whether the capture resolves to
     * a product at all — by its own link, or by (platform, externalId) against
     * SupplierProduct, which is uniquely indexed on that pair.
     */
    prisma.supplierCapture
      .findMany({ select: { importedProductId: true, platform: true, externalId: true } })
      .catch(() => []),
  ]);

  const active = products.filter((p) => p.status === 'ACTIVE');

  const unlinked = captures.filter((c) => !c.importedProductId && c.externalId);
  const links = unlinked.length
    ? await prisma.supplierProduct
        .findMany({
          where: {
            OR: unlinked.map((c) => ({
              platform: c.platform,
              externalId: c.externalId as string,
            })),
          },
          select: { platform: true, externalId: true },
        })
        .catch(() => [])
    : [];
  const linked = new Set(links.map((l) => `${l.platform}:${l.externalId}`));
  const orphanCaptures = captures.filter(
    (c) => !c.importedProductId && !linked.has(`${c.platform}:${c.externalId}`)
  ).length;

  // ---- money ---------------------------------------------------------------

  const loss = active.flatMap((p) =>
    p.variants
      .filter((v) => v.costMinor > 0 && v.priceMinor <= v.costMinor)
      .map((v) => `${p.title.slice(0, 46)} — ${v.title.slice(0, 26)}`)
  );
  add({
    id: 'loss-making',
    severity: 'critical',
    title: 'Variants priced at or below what they cost',
    count: loss.length,
    detail:
      'Every one of these loses money on each sale, and ads would scale the loss. Re-price them or take the variant down.',
    examples: loss.slice(0, 6),
  });

  const freePriced = active.flatMap((p) =>
    p.variants.filter((v) => v.priceMinor <= 0).map((v) => `${p.title.slice(0, 46)} — ${v.title.slice(0, 26)}`)
  );
  add({
    id: 'zero-price',
    severity: 'critical',
    title: 'Live variants with no price',
    count: freePriced.length,
    detail: 'A shopper can add these to the bag for nothing. Price them or unpublish the product.',
    examples: freePriced.slice(0, 6),
  });

  const noCost = active.flatMap((p) =>
    p.variants.filter((v) => v.costMinor <= 0).map((v) => `${p.title.slice(0, 46)} — ${v.title.slice(0, 26)}`)
  );
  add({
    id: 'no-cost',
    severity: 'warning',
    title: 'Live variants with no recorded cost',
    count: noCost.length,
    detail:
      'Profit on these is guesswork: the dashboard counts their cost as zero, so reported profit is overstated by whatever they actually cost you.',
    examples: noCost.slice(0, 6),
  });

  // ---- can a customer buy it? ---------------------------------------------

  const noImages = active.filter((p) => p.images.length === 0).map((p) => p.title.slice(0, 56));
  add({
    id: 'no-images',
    severity: 'critical',
    title: 'Live products with no photograph',
    count: noImages.length,
    detail: 'Nobody buys a blank square. These are live and effectively unsellable.',
    examples: noImages.slice(0, 6),
  });

  const oneImage = active
    .filter((p) => p.images.length === 1)
    .map((p) => p.title.slice(0, 56));
  add({
    id: 'one-image',
    severity: 'info',
    title: 'Live products with only one photograph',
    count: oneImage.length,
    detail:
      'A single angle converts worse than several. Worth adding supplier photos to the best sellers first, not all at once.',
    examples: oneImage.slice(0, 4),
  });

  const thin = active
    .filter((p) => (p.descriptionHtml ?? '').replace(/<[^>]*>/g, '').trim().length < 120)
    .map((p) => p.title.slice(0, 56));
  add({
    id: 'thin-description',
    severity: 'warning',
    title: 'Live products with little or no description',
    count: thin.length,
    detail:
      'Nothing for a shopper to read and nothing for Google to index. The copywriter can fill these in.',
    examples: thin.slice(0, 6),
  });

  const uncollected = active
    .filter((p) => p.collections.length === 0)
    .map((p) => p.title.slice(0, 56));
  add({
    id: 'no-collection',
    severity: 'warning',
    title: 'Live products in no category',
    count: uncollected.length,
    detail:
      'Reachable only by direct link or search — they do not appear under any department, so most visitors will never see them.',
    examples: uncollected.slice(0, 6),
  });

  const drafts = products.filter((p) => p.status !== 'ACTIVE').map((p) => p.title.slice(0, 56));
  add({
    id: 'drafts',
    severity: 'info',
    title: 'Products still in draft',
    count: drafts.length,
    detail: 'Imported but never published, so no customer can see them. Publish or delete.',
    examples: drafts.slice(0, 6),
  });

  // ---- fulfilment ----------------------------------------------------------

  const unmappable = active
    .filter((p) => p.variants.some((v) => !v.supplierVariantId))
    .map((p) => p.title.slice(0, 56));
  add({
    id: 'no-supplier-sku',
    severity: 'warning',
    title: 'Live products whose variants carry no supplier SKU',
    count: unmappable.length,
    detail:
      'These cannot be placed with AliExpress automatically — the button refuses rather than risk shipping the wrong colour. They must be ordered by hand until re-captured.',
    examples: unmappable.slice(0, 6),
  });

  const paidNoSupplier = orders
    .filter((o) => o.paymentStatus === 'PAID' && o.supplierOrders.length === 0)
    .map((o) => `#${o.number}`);
  add({
    id: 'paid-not-routed',
    severity: 'critical',
    title: 'Paid orders with nothing queued for the supplier',
    count: paidNoSupplier.length,
    detail: 'The customer has paid and nothing is on its way to them.',
    examples: paidNoSupplier.slice(0, 6),
  });

  const stalePending = supplierOrders
    .filter((s) => s.status === 'PENDING' && Date.now() - s.createdAt.getTime() > 3 * DAY)
    .map((s) => `#${s.order.number}`);
  add({
    id: 'stale-pending',
    severity: 'critical',
    title: 'Supplier orders waiting more than three days',
    count: stalePending.length,
    detail: 'Paid for, not yet ordered from the supplier. This is where refund requests come from.',
    examples: stalePending.slice(0, 6),
  });

  const noTracking = supplierOrders
    .filter(
      (s) =>
        s.status === 'PLACED' &&
        !s.trackingNumber &&
        s.placedAt &&
        Date.now() - s.placedAt.getTime() > 7 * DAY
    )
    .map((s) => `#${s.order.number}`);
  add({
    id: 'no-tracking',
    severity: 'warning',
    title: 'Placed over a week ago with no tracking number',
    count: noTracking.length,
    detail: 'Either the supplier has not shipped, or the tracking sync is not reaching this order.',
    examples: noTracking.slice(0, 6),
  });

  // ---- settings and plumbing ----------------------------------------------

  const staleRates = rates
    .filter((r) => Date.now() - r.updatedAt.getTime() > 7 * DAY)
    .map((r) => r.code);
  add({
    id: 'stale-fx',
    severity: 'warning',
    title: 'Exchange rates over a week old',
    count: staleRates.length,
    detail:
      'Prices shown to overseas shoppers drift from reality, and the naira moves. The daily refresh may not be running.',
    examples: staleRates,
  });

  const offered = settings.displayCurrencies.filter(
    (c) => c !== settings.baseCurrency && !rates.some((r) => r.code === c && r.rate > 0)
  );
  add({
    id: 'currency-no-rate',
    severity: 'warning',
    title: 'Currencies offered with no exchange rate',
    count: offered.length,
    detail: 'The switcher lists these but cannot convert, so they silently fall back to naira.',
    examples: offered,
  });

  add({
    id: 'no-support-email',
    severity: settings.supportEmail ? 'info' : 'critical',
    title: 'No support email set',
    count: settings.supportEmail ? 0 : 1,
    detail:
      'Order confirmations, shipping notices and the contact form all need a real mailbox to send from and reply to.',
    examples: [],
  });

  add({
    id: 'mail-off',
    severity: 'critical',
    title: 'Outgoing email is not configured',
    count: isMailConfigured() ? 0 : 1,
    detail:
      'No order confirmation and no shipping notice will be sent. Silence after payment is what a scam feels like.',
    examples: [],
  });

  /*
   * The AliExpress connection, checked rather than assumed.
   *
   * The access token renews itself on every call, so it is not the thing that
   * breaks. What breaks is the REFRESH token behind it: when that lapses, or a
   * renewal fails, every call starts answering "not connected" — and the first
   * anyone hears of it is a failed import or, worse, an order that cannot be
   * placed. Everything built on this API depends on it, so it is worth a line
   * here rather than a surprise later.
   */
  const link = isAliexpressConfigured() ? await storedToken() : null;
  const daysLeft = link ? Math.floor((link.expiresAt - Date.now()) / DAY) : 0;
  add({
    id: 'aliexpress-disconnected',
    severity: 'critical',
    title: 'AliExpress is not connected',
    count: isAliexpressConfigured() && !link ? 1 : 0,
    detail:
      'No supplier lookups, no automatic ordering and no SKU recovery. Reconnect from the AliExpress settings.',
    examples: [],
  });
  add({
    id: 'aliexpress-expiring',
    severity: 'warning',
    title: 'AliExpress access token is due to renew',
    // Only worth mentioning when renewal is overdue rather than merely due:
    // it renews itself on the next call, so a token expiring in an hour is
    // normal operation, not a problem.
    count: link && daysLeft < -1 ? 1 : 0,
    detail:
      'It should have renewed itself by now and has not, which usually means the refresh token has lapsed. Reconnect before the next order.',
    examples: link ? [`expired ${Math.abs(daysLeft)} day(s) ago`] : [],
  });

  add({
    id: 'unpriced-captures',
    severity: 'info',
    title: 'Captured products never priced or imported',
    count: orphanCaptures,
    detail: 'Sitting in the import queue doing nothing. Price them or clear them out.',
    examples: [],
  });

  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    products: products.length,
    live: active.length,
    orders: orders.length,
    findings,
  });
}
