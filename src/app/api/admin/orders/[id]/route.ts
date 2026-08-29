import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
 * Every relation on Order cascades, so this also removes its line items,
 * payments, supplier orders and event history. That is the point — a half
 * deleted order leaves payment rows pointing at nothing.
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

  await prisma.order.delete({ where: { id } });

  return NextResponse.json({ ok: true, deleted: order.number });
}
