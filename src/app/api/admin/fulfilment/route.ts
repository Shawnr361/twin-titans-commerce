import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { markPlaced, markShipped } from '@/lib/dropship/fulfilment';

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
    } else {
      await markShipped(
        parsed.data.supplierOrderId,
        parsed.data.trackingNumber,
        parsed.data.carrier || undefined
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed.' },
      { status: 500 }
    );
  }
}
