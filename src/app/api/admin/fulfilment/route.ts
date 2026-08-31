import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import {
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
