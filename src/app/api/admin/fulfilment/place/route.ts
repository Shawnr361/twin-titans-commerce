import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { placeWholeOrder, placeWithSupplier } from '@/lib/dropship/aliexpress-place';

export const dynamic = 'force-dynamic';

/*
 * Either one seller's order, or every outstanding one on a customer's payment.
 * The queue offers the second: a customer who paid once should cost one click.
 */
const schema = z.union([
  z.object({ supplierOrderId: z.string().min(1) }),
  z.object({ orderId: z.string().min(1) }),
]);

/**
 * Place ONE supplier order with AliExpress.
 *
 * Deliberately not a "place everything pending" endpoint. The underlying API
 * is "Order Create and Pay" — it spends money with no confirmation step — and
 * a single mistake looped over the whole queue would buy the entire backlog
 * wrongly, in one click, with no way to unwind it.
 */
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
    const result =
      'orderId' in parsed.data
        ? await placeWholeOrder(parsed.data.orderId)
        : await placeWithSupplier(parsed.data.supplierOrderId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        detail: `Placing failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}
