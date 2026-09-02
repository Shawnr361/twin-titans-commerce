import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendOrderConfirmation, sendShippingNotice } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * Send the confirmations that never went out.
 *
 * Two paid orders got nothing, because the mail path answered "550 relay not
 * permitted" and the failure was recorded rather than shown. Those customers
 * have paid and heard silence, which is the single worst impression a new shop
 * can make — and it is not fixed by making the next order work.
 *
 * Only orders with NO successful confirmation are touched, so this cannot spam
 * anyone who already had one: sendOrderConfirmation records an event on
 * success, and refuses to send twice on the strength of it.
 *
 * Shipping notices are re-sent too where a tracking number exists but no notice
 * was recorded — the same silence, one step further along.
 */
const schema = z.object({ apply: z.boolean().optional() });

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

  const paid = await prisma.order.findMany({
    where: { paymentStatus: 'PAID' },
    select: { id: true, number: true, email: true },
  });

  const sentAlready = await prisma.orderEvent.findMany({
    where: { orderId: { in: paid.map((o) => o.id) }, kind: 'email_confirmation' },
    select: { orderId: true },
  });
  const has = new Set(sentAlready.map((e) => e.orderId));
  const silent = paid.filter((o) => !has.has(o.id));

  const shipped = await prisma.supplierOrder.findMany({
    where: { trackingNumber: { not: null } },
    select: { id: true, orderId: true, order: { select: { number: true } } },
  });
  const noticeEvents = await prisma.orderEvent.findMany({
    where: { orderId: { in: shipped.map((s) => s.orderId) }, kind: 'email_shipped' },
    select: { orderId: true },
  });
  const notified = new Set(noticeEvents.map((e) => e.orderId));
  const silentShipments = shipped.filter((s) => !notified.has(s.orderId));

  if (!apply) {
    return NextResponse.json({
      applied: false,
      confirmationsToSend: silent.map((o) => `#${o.number} → ${o.email}`),
      shippingNoticesToSend: silentShipments.map((s) => `#${s.order.number}`),
    });
  }

  const results: string[] = [];
  for (const order of silent) {
    await sendOrderConfirmation(order.id);
    const ok = await prisma.orderEvent.findFirst({
      where: { orderId: order.id, kind: 'email_confirmation' },
      select: { id: true },
    });
    results.push(`#${order.number} ${ok ? 'sent' : 'FAILED — see order events'}`);
  }
  for (const shipment of silentShipments) {
    await sendShippingNotice(shipment.id);
    results.push(`#${shipment.order.number} shipping notice attempted`);
  }

  return NextResponse.json({ applied: true, results });
}
