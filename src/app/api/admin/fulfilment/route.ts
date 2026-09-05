import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import {
  markDelivered,
  reopenSupplierOrder,
  markOrderRefunded,
  markPlaced,
  markShipped,
  markSupplierCancelled,
} from '@/lib/dropship/fulfilment';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('place'),
    supplierOrderId: z.string().min(1),
    externalOrderNo: z.string().min(1),
  }),
  z.object({
    action: z.literal('ship'),
    supplierOrderId: z.string().min(1),
    trackingNumber: z.string().min(1),
    carrier: z.string().optional(),
  }),
  /*
   * Manual delivery, for parcels the API cannot see.
   *
   * Anything placed by hand has no AliExpress order number, so the tracking
   * cron can never mark it delivered — and a review cannot be left until
   * something does.
   */
  z.object({
    action: z.literal('deliver'),
    supplierOrderId: z.string().min(1),
  }),
  /*
   * Put a leg back in the queue when its AliExpress purchase died unpaid.
   * A reason is required because this is how a "handled" order becomes
   * unhandled again, and the timeline should say who decided that and why.
   */
  z.object({
    action: z.literal('reopen'),
    supplierOrderId: z.string().min(1),
    reason: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal('cancel'),
    supplierOrderId: z.string().min(1),
    reason: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal('refund'),
    orderId: z.string().min(1),
    reason: z.string().min(1).max(300),
  }),
]);

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    if (parsed.data.action === 'place') {
      await markPlaced(parsed.data.supplierOrderId, parsed.data.externalOrderNo);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === 'ship') {
      await markShipped(
        parsed.data.supplierOrderId,
        parsed.data.trackingNumber,
        parsed.data.carrier || undefined
      );
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === 'deliver') {
      await markDelivered(parsed.data.supplierOrderId);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === 'reopen') {
      const r = await reopenSupplierOrder(parsed.data.supplierOrderId, parsed.data.reason);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }

    if (parsed.data.action === 'cancel') {
      const r = await markSupplierCancelled(parsed.data.supplierOrderId, parsed.data.reason);
      return NextResponse.json({
        ok: true,
        /*
         * Surfaced, not logged. Cancelling here records our intent; it cannot
         * reach into AliExpress and stop a parcel that is already paid for.
         */
        warnings: r.wasPlaced
          ? ['This was already placed with the supplier — cancel it on AliExpress too.']
          : [],
      });
    }

    const r = await markOrderRefunded(parsed.data.orderId, parsed.data.reason);
    return NextResponse.json({
      ok: true,
      warnings: [
        'Marked refunded in the books only — issue the actual refund in Flutterwave or PayPal.',
        r.supplierOrdersOpen > 0
          ? `${r.supplierOrdersOpen} supplier order(s) are still open on this order.`
          : null,
      ].filter(Boolean),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed.' },
      { status: 500 }
    );
  }
}
