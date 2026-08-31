import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** Prisma errors are multi-line; the last line is the part a human needs. */
function lastLine(message: string): string {
  const parts = message.split(/\s*\n\s*/).filter((l) => l.trim());
  return (parts[parts.length - 1] ?? message).trim();
}

const patchSchema = z.object({
  status: z.enum(['CANCELLED', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'REFUNDED', 'PAID']),
  reason: z.string().max(300).optional(),
});

/**
 * Change an order's status — in practice, cancelling one.
 *
 * A customer who changes their mind before dispatch is the ordinary case, and
 * it must NOT be a delete: the money may already have moved, and the order is
 * what a refund reconciles against. Cancelling keeps the record and marks it
 * unfulfillable.
 *
 * Payment status is deliberately untouched. An order can be CANCELLED and still
 * PAID — that is precisely the state that says "we owe this person a refund",
 * and collapsing the two would erase the debt from the books.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      supplierOrders: { select: { status: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
  }

  const { status, reason } = parsed.data;

  /*
   * Cancelling here does not reach the supplier. If goods are already on their
   * way, saying "cancelled" without saying that would leave the merchant
   * believing a parcel had been stopped that is still in transit.
   */
  const inFlight = order.supplierOrders.filter(
    (s) => s.status === 'PLACED' || s.status === 'SHIPPED'
  ).length;

  await prisma.$transaction([
    prisma.order.update({ where: { id }, data: { status } }),
    prisma.orderEvent.create({
      data: {
        orderId: id,
        kind: 'status',
        message:
          `Status changed from ${order.status} to ${status} by an admin` +
          (reason ? `: ${reason}` : '.'),
        data: { from: order.status, to: status, reason: reason ?? null },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    status,
    /*
     * Surfaced rather than logged: these are the two things that still need a
     * human afterwards, and neither is visible from the order list.
     */
    warnings: [
      inFlight > 0
        ? `${inFlight} supplier order(s) are already placed or shipped — cancel them with the supplier yourself.`
        : null,
      status === 'CANCELLED' && order.paymentStatus === 'PAID'
        ? 'This order is still marked PAID. Refund it in Flutterwave or PayPal — cancelling here does not move money.'
        : null,
    ].filter(Boolean),
  });
}

/**
 * Delete an order.
 *
 * Removes its line items, payments, supplier orders, reviews and event
 * history as well — a half deleted order leaves payment rows pointing at
 * nothing. Done explicitly rather than relying on cascade, because these
 * tables were created by hand and the constraints are not uniform.
 *
 * A PAID order is refused. It is a financial record: it reconciles against what
 * the gateway actually settled, against what was bought from the supplier, and
 * against the margin reporting. Deleting one does not undo any of that, it just
 * removes the evidence that it happened. `force` exists for the deliberate
 * exception, and has to be asked for explicitly.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, number: true, paymentStatus: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
  }

  if (order.paymentStatus === 'PAID' && !force) {
    return NextResponse.json(
      {
        error:
          `Order #${order.number} is PAID and was not deleted. A paid order is a financial ` +
          `record that reconciles against the gateway and the supplier. Cancel or refund it ` +
          `instead, or re-send with ?force=true if you are certain.`,
      },
      { status: 409 }
    );
  }

  /*
   * Children are removed explicitly, in foreign-key order, inside one
   * transaction.
   *
   * The comment above used to say "every relation on Order cascades" — that is
   * true of the PRISMA schema, but the tables on this host were created by hand
   * in phpMyAdmin and do not all carry ON DELETE CASCADE. So `order.delete()`
   * alone threw a foreign-key error, and because the call had no try/catch the
   * route answered an EMPTY 500. The button reported "Could not delete that
   * order" with no reason, which is exactly the symptom that was reported.
   *
   * Doing it explicitly is also correct where the constraints DO cascade: the
   * rows are already gone by the time the parent delete runs, so it is a no-op
   * rather than a conflict.
   */
  try {
    const supplierOrders = await prisma.supplierOrder.findMany({
      where: { orderId: id },
      select: { id: true },
    });
    const supplierOrderIds = supplierOrders.map((s) => s.id);

    await prisma.$transaction([
      prisma.supplierOrderItem.deleteMany({
        where: { supplierOrderId: { in: supplierOrderIds } },
      }),
      prisma.supplierOrder.deleteMany({ where: { orderId: id } }),
      prisma.review.deleteMany({ where: { orderId: id } }),
      prisma.orderEvent.deleteMany({ where: { orderId: id } }),
      prisma.payment.deleteMany({ where: { orderId: id } }),
      prisma.orderLineItem.deleteMany({ where: { orderId: id } }),
      prisma.order.delete({ where: { id } }),
    ]);
  } catch (err) {
    /*
     * Never an empty 500 again. Whatever the database objected to, the admin
     * sees it — a delete that fails silently is indistinguishable from a
     * permissions bug.
     */
    return NextResponse.json(
      {
        error:
          `Order #${order.number} could not be deleted: ` +
          (err instanceof Error ? lastLine(err.message) : 'unknown error'),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deleted: order.number });
}
