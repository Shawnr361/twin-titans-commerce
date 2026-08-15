import { NextResponse } from 'next/server';
import { markOrderPaid } from '@/lib/orders';
import { verifyWebhookSignature } from '@/lib/payments/paystack';

/**
 * Paystack webhook — the AUTHORITATIVE payment signal.
 *
 * The browser redirect after payment is a convenience; it can be closed, lost
 * to a dead connection, or replayed. This endpoint is what actually marks money
 * received and triggers supplier ordering, so it verifies the HMAC over the RAW
 * body and is safe to receive twice.
 */
export async function POST(request: Request) {
  // Must be the raw text — re-serialising parsed JSON breaks the signature.
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let event: {
    event: string;
    data: {
      reference: string;
      amount: number;
      currency: string;
      fees?: number;
      status: string;
      metadata?: { orderId?: string };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }

  if (event.event !== 'charge.success' || event.data.status !== 'success') {
    // Acknowledge everything else so Paystack stops retrying.
    return NextResponse.json({ received: true });
  }

  const orderId = event.data.metadata?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'No orderId in metadata.' }, { status: 400 });
  }

  try {
    const result = await markOrderPaid({
      orderId,
      provider: 'PAYSTACK',
      reference: event.data.reference,
      amountMinor: event.data.amount,
      currency: event.data.currency,
      feeMinor: event.data.fees ?? 0,
      raw: event,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // Return 500 so Paystack retries — losing a paid order is unacceptable.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed.' },
      { status: 500 }
    );
  }
}
