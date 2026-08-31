import { prisma } from '../db';
import type { Platform } from '../suppliers/types';

/**
 * Order routing — the mechanic that makes this a dropshipping store.
 *
 * When a customer pays, nothing ships from us. The order is split by supplier
 * and each supplier gets an order whose ship-to is the CUSTOMER's address. We
 * pay supplier cost, we keep the spread, and we never hold stock.
 *
 * Placement itself has two modes:
 *   - AUTO: an adapter with real credentials places the order over an API.
 *   - ASSISTED (default): we produce a complete, ready-to-paste order sheet
 *     with the exact listing URL, the exact SKU, and the customer's address.
 *
 * ASSISTED is the default on purpose. AliExpress's dropship order API is
 * approval-gated, and a half-working auto-placer that silently fails is far
 * worse than a 30-second paste — a customer who paid and never gets shipped is
 * the one failure this business cannot absorb.
 */

export interface ShippingAddress {
  name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postcode?: string;
  country: string;
}

export function isCompleteAddress(a: Partial<ShippingAddress> | null | undefined): a is ShippingAddress {
  return Boolean(a?.name && a?.line1 && a?.city && a?.country);
}

/**
 * Split a paid order into one SupplierOrder per supplier.
 * Idempotent: calling it twice for the same order will not double-place.
 */
export async function routeOrderToSuppliers(orderId: string): Promise<{
  created: number;
  skipped: string[];
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lineItems: true,
      supplierOrders: { select: { id: true } },
    },
  });

  if (!order) throw new Error(`Order ${orderId} not found.`);
  if (order.paymentStatus !== 'PAID') {
    throw new Error('Refusing to place supplier orders for an order that is not paid.');
  }
  if (order.supplierOrders.length > 0) {
    return { created: 0, skipped: ['Supplier orders already exist for this order.'] };
  }

  const shipTo = order.shippingAddress as unknown as ShippingAddress;
  if (!isCompleteAddress(shipTo)) {
    throw new Error('Order has an incomplete shipping address — cannot route to a supplier.');
  }

  const skipped: string[] = [];
  const bySupplier = new Map<string, typeof order.lineItems>();

  for (const item of order.lineItems) {
    if (!item.supplierId || !item.sourceUrl) {
      skipped.push(
        `"${item.productTitle}" has no supplier link on file — fulfil this one manually.`
      );
      continue;
    }
    const bucket = bySupplier.get(item.supplierId) ?? [];
    bucket.push(item);
    bySupplier.set(item.supplierId, bucket);
  }

  let created = 0;

  for (const [supplierId, items] of bySupplier) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      skipped.push(`Supplier ${supplierId} no longer exists.`);
      continue;
    }

    const costMinor = items.reduce((sum, i) => sum + i.unitCostMinor * i.quantity, 0);

    await prisma.supplierOrder.create({
      data: {
        orderId: order.id,
        supplierId,
        platform: supplier.platform,
        status: 'PENDING',
        costMinor,
        currency: order.currency,
        shipTo: shipTo as never,
        items: {
          create: items.map((i) => ({
            orderLineItemId: i.id,
            sourceUrl: i.sourceUrl!,
            externalVariantId: i.supplierVariantId,
            variantLabel: i.variantTitle,
            quantity: i.quantity,
          })),
        },
      },
    });
    created++;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: created > 0 ? 'FULFILLING' : order.status },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      kind: 'routed',
      message:
        created > 0
          ? `Split into ${created} supplier order(s).`
          : 'No supplier orders could be created.',
      data: { skipped } as never,
    },
  });

  return { created, skipped };
}

/**
 * Everything a human (or an API adapter) needs to place one supplier order.
 * Deliberately plain text — it gets pasted into a supplier chat or checkout.
 */
export interface OrderSheet {
  supplierOrderId: string;
  /** The customer order this purchase belongs to — needed to record a refund. */
  orderId: string;
  supplierName: string;
  platform: Platform;
  orderNumber: number;
  lines: {
    url: string;
    sku: string;
    variant: string;
    quantity: number;
    /** From the customer's line item, so the picker can see what was bought. */
    title: string | null;
    imageUrl: string | null;
  }[];
  shipTo: ShippingAddress;
  /** Copy-paste block for the supplier's checkout / chat. */
  text: string;
  /** Never leak our retail price or margin to the supplier. */
  estimatedCostMinor: number;
  currency: string;
}

export async function buildOrderSheet(supplierOrderId: string): Promise<OrderSheet> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: {
      supplier: true,
      order: { select: { number: true } },
      /*
       * The image and title live on the customer's line item, not on the
       * supplier item — so pull them through. Buying the wrong colour is the
       * easy mistake to make from a URL and an option label alone.
       */
      items: {
        include: {
          orderLineItem: { select: { imageUrl: true, productTitle: true } },
        },
      },
    },
  });
  if (!so) throw new Error('Supplier order not found.');

  const shipTo = so.shipTo as unknown as ShippingAddress;

  const lines = so.items.map((i) => ({
    url: i.sourceUrl,
    sku: i.externalVariantId ?? '—',
    variant: i.variantLabel ?? 'Default',
    quantity: i.quantity,
    title: i.orderLineItem?.productTitle ?? null,
    imageUrl: i.orderLineItem?.imageUrl ?? null,
  }));

  const addressBlock = [
    shipTo.name,
    shipTo.line1,
    shipTo.line2,
    [shipTo.city, shipTo.state].filter(Boolean).join(', '),
    [shipTo.postcode, shipTo.country].filter(Boolean).join(' '),
    shipTo.phone ? `Tel: ${shipTo.phone}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const text = [
    `ORDER ${so.order.number} — ${so.supplier.name}`,
    '',
    ...lines.flatMap((l) => [
      `Item: ${l.url}`,
      `  Variant: ${l.variant}`,
      `  SKU: ${l.sku}`,
      `  Qty: ${l.quantity}`,
      '',
    ]),
    'SHIP DIRECTLY TO:',
    addressBlock,
    '',
    'Please ship with no invoice, price tag, or promotional material in the parcel.',
  ].join('\n');

  return {
    supplierOrderId: so.id,
    orderId: so.orderId,
    supplierName: so.supplier.name,
    platform: so.platform as Platform,
    orderNumber: so.order.number,
    lines,
    shipTo,
    text,
    estimatedCostMinor: so.costMinor,
    currency: so.currency,
  };
}

/** Record that a supplier order was placed, with their order number. */
export async function markPlaced(
  supplierOrderId: string,
  externalOrderNo: string,
  costMinor?: number
): Promise<void> {
  const so = await prisma.supplierOrder.update({
    where: { id: supplierOrderId },
    data: {
      status: 'PLACED',
      externalOrderNo,
      placedAt: new Date(),
      ...(costMinor != null ? { costMinor } : {}),
    },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: so.orderId,
      kind: 'supplier_placed',
      message: `Supplier order placed (${externalOrderNo}).`,
    },
  });
}

const CARRIER_TRACK_URLS: Record<string, string> = {
  cainiao: 'https://global.cainiao.com/detail.htm?mailNoList=',
  yanwen: 'https://track.yw56.com.cn/en/querydel?nums=',
  yunexpress: 'https://www.yuntrack.com/parcelTracking?id=',
  dhl: 'https://www.dhl.com/en/express/tracking.html?AWB=',
  ups: 'https://www.ups.com/track?tracknum=',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr=',
};

export function trackingUrlFor(carrier: string | null, number: string): string {
  const key = (carrier ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const base = CARRIER_TRACK_URLS[key];
  if (base) return base + encodeURIComponent(number);
  // 17track handles essentially every Chinese-origin carrier.
  return `https://t.17track.net/en#nums=${encodeURIComponent(number)}`;
}

/** Attach tracking and move the order forward. */
export async function markShipped(
  supplierOrderId: string,
  trackingNumber: string,
  carrier?: string
): Promise<void> {
  const so = await prisma.supplierOrder.update({
    where: { id: supplierOrderId },
    data: {
      status: 'SHIPPED',
      trackingNumber,
      trackingCarrier: carrier,
      trackingUrl: trackingUrlFor(carrier ?? null, trackingNumber),
      shippedAt: new Date(),
    },
    include: { order: { include: { supplierOrders: true } } },
  });

  // The customer's order is only "shipped" once every supplier leg has shipped.
  const allShipped = so.order.supplierOrders.every(
    (s) => s.status === 'SHIPPED' || s.status === 'DELIVERED' || s.status === 'CANCELLED'
  );

  await prisma.order.update({
    where: { id: so.orderId },
    data: { status: allShipped ? 'SHIPPED' : 'FULFILLING' },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: so.orderId,
      kind: 'supplier_shipped',
      message: `Tracking ${trackingNumber}${carrier ? ` (${carrier})` : ''}.`,
    },
  });
}

/**
 * Cancel one supplier order — we are not buying this from the supplier.
 *
 * Scoped to the SUPPLIER side only. An order can split across several
 * suppliers, and cancelling one purchase says nothing about whether the
 * customer still wants the rest, so the customer's order status is left alone.
 * Use the order's own Cancel for that.
 *
 * `reason` is required by the caller rather than optional: a cancelled purchase
 * with no recorded reason is the row that nobody can explain a week later.
 */
export async function markSupplierCancelled(
  supplierOrderId: string,
  reason: string
): Promise<{ orderNumber: number; wasPlaced: boolean }> {
  const existing = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    select: { status: true, externalOrderNo: true, order: { select: { number: true } } },
  });
  if (!existing) throw new Error('That supplier order no longer exists.');

  /*
   * Already placed means money may already have left for the supplier.
   * Cancelling here only records OUR intent — it cannot reach into AliExpress
   * and stop the parcel, so the caller is told to do that themselves.
   */
  const wasPlaced = existing.status === 'PLACED' || existing.status === 'SHIPPED';

  const so = await prisma.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { status: 'CANCELLED' },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: so.orderId,
      kind: 'supplier_cancelled',
      message:
        `Supplier order cancelled: ${reason}` +
        (existing.externalOrderNo ? ` (supplier ref ${existing.externalOrderNo})` : ''),
      data: { from: existing.status, reason, externalOrderNo: existing.externalOrderNo },
    },
  });

  return { orderNumber: existing.order.number, wasPlaced };
}

/**
 * Record that the customer has been refunded.
 *
 * Bookkeeping only. This does NOT move money: refunds happen in Flutterwave or
 * PayPal, and pretending otherwise here would mark a customer repaid who is
 * still out of pocket. The caller is told so explicitly.
 *
 * Both statuses move together, unlike cancellation. A refund is the end of the
 * line for the whole order, so leaving `status` behind would keep it sitting in
 * the fulfilment queue as work still to do.
 */
export async function markOrderRefunded(
  orderId: string,
  reason: string
): Promise<{ orderNumber: number; supplierOrdersOpen: number }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      paymentStatus: true,
      supplierOrders: { select: { status: true } },
    },
  });
  if (!order) throw new Error('That order no longer exists.');

  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
    throw new Error(
      `Order #${order.number} is ${order.paymentStatus}, so there is nothing to refund.`
    );
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
    }),
    prisma.orderEvent.create({
      data: {
        orderId,
        kind: 'refunded',
        message: `Marked refunded by an admin: ${reason}`,
        data: { reason },
      },
    }),
  ]);

  return {
    orderNumber: order.number,
    supplierOrdersOpen: order.supplierOrders.filter(
      (s) => s.status !== 'CANCELLED' && s.status !== 'DELIVERED'
    ).length,
  };
}
