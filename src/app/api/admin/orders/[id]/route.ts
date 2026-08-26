import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
