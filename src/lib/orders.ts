import { prisma } from './db';
import type { HydratedCart } from './cart';
import type { ShippingAddress } from './dropship/fulfilment';
import { routeOrderToSuppliers } from './dropship/fulfilment';

export interface CreateOrderInput {
  cart: HydratedCart;
  email: string;
  phone?: string;
  shippingAddress: ShippingAddress;
  note?: string;
  discountCode?: string;
  presentmentCurrency?: string;
  presentmentRate?: number;
}

/**
 * Create a PENDING order from a hydrated cart.
 *
 * Every line snapshots the supplier link, SKU and cost at the moment of sale.
 * That snapshot is what lets us fulfil months later even if the product has
 * since been re-sourced, re-priced, or deleted — the old store had landing
 * pages pointing at variant ids that no longer existed, and this is the fix.
 */
export async function createOrder(input: CreateOrderInput) {
  const { cart } = input;
  const sellable = cart.lines.filter((l) => l.available);
  if (sellable.length === 0) throw new Error('Your cart is empty.');

  // Pull supplier linkage for every variant in one query.
  const variants = await prisma.variant.findMany({
    where: { id: { in: sellable.map((l) => l.variantId) } },
    include: {
      product: {
        select: {
          handle: true,
          source: { select: { supplierId: true, sourceUrl: true, platform: true } },
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const customer = await prisma.customer.upsert({
    where: { email: input.email.toLowerCase().trim() },
    create: {
      email: input.email.toLowerCase().trim(),
      name: input.shippingAddress.name,
      phone: input.phone,
    },
    update: { name: input.shippingAddress.name, phone: input.phone ?? undefined },
  });

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      email: customer.email,
      phone: input.phone,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      currency: cart.currency,
      subtotalMinor: cart.subtotalMinor,
      shippingMinor: cart.shippingMinor,
      discountMinor: 0,
      totalMinor: cart.totalMinor,
      costMinor: cart.costMinor,
      presentmentCurrency: input.presentmentCurrency,
      presentmentRate: input.presentmentRate,
      discountCode: input.discountCode,
      shippingAddress: input.shippingAddress as never,
      note: input.note,
      lineItems: {
        create: sellable.map((l) => {
          const v = byId.get(l.variantId);
          const src = v?.product.source;
          return {
            variantId: l.variantId,
            productTitle: l.productTitle,
            variantTitle: l.variantTitle,
            productHandle: l.productHandle,
            sku: l.sku,
            imageUrl: l.imageUrl,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            unitCostMinor: l.unitCostMinor,
            sourceUrl: src?.sourceUrl,
            sourcePlatform: src?.platform,
            supplierId: src?.supplierId,
            supplierVariantId: v?.supplierVariantId,
          };
        }),
      },
      events: {
        create: { kind: 'created', message: 'Order created, awaiting payment.' },
      },
    },
    include: { lineItems: true },
  });

  return order;
}

/**
 * Mark an order paid and immediately route it to suppliers.
 *
 * Idempotent by payment reference: gateways retry webhooks, and double-routing
 * would mean double-buying the goods.
 */
export async function markOrderPaid(params: {
  orderId: string;
  provider: 'PAYSTACK' | 'PAYPAL' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';
  reference: string;
  amountMinor: number;
  currency: string;
  feeMinor?: number;
  raw?: unknown;
}): Promise<{ alreadyProcessed: boolean; routed: number; issues: string[] }> {
  const existing = await prisma.payment.findUnique({ where: { reference: params.reference } });
  if (existing?.status === 'PAID') {
    return { alreadyProcessed: true, routed: 0, issues: [] };
  }

  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new Error('Order not found.');

  await prisma.payment.upsert({
    where: { reference: params.reference },
    create: {
      orderId: order.id,
      provider: params.provider,
      reference: params.reference,
      status: 'PAID',
      amountMinor: params.amountMinor,
      currency: params.currency,
      feeMinor: params.feeMinor ?? 0,
      raw: (params.raw ?? null) as never,
    },
    update: { status: 'PAID', raw: (params.raw ?? null) as never },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: 'PAID', status: 'PAID' },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      kind: 'paid',
      message: `Payment confirmed via ${params.provider} (${params.reference}).`,
    },
  });

  // Route to suppliers straight away — a paid order that sits unrouted is the
  // single worst state this system can be in.
  try {
    const routed = await routeOrderToSuppliers(order.id);
    return { alreadyProcessed: false, routed: routed.created, issues: routed.skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown routing error.';
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        kind: 'routing_failed',
        message: `Could not auto-route to suppliers: ${message}`,
      },
    });
    return { alreadyProcessed: false, routed: 0, issues: [message] };
  }
}

export function orderMarginMinor(order: { totalMinor: number; costMinor: number; shippingMinor: number }) {
  return order.totalMinor - order.shippingMinor - order.costMinor;
}
