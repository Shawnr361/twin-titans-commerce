import { NextResponse } from 'next/server';
import { markOrderPaid } from '@/lib/orders';
import { verifyByReference, verifyWebhookHash } from '@/lib/payments/flutterwave';

/**
 * Flutterwave webhook — the AUTHORITATIVE payment signal.
 *
 * The browser redirect after payment is a convenience; it can be closed, lost
 * to a dead connection, or replayed. This endpoint is what actually marks money
 * received and triggers supplier ordering, so it is safe to receive twice.
 *
 * TWO CHECKS, NOT ONE
 * -------------------
 * `verif-hash` is a STATIC shared secret, not a signature over the body, so it
 * proves only that the sender knows the secret — not that the body is genuine.
 * Anyone who ever learns that string could post "you were paid ₦5,000,000".
 * So the header is treated as a cheap filter, and the amount that actually gets
 * recorded is re-read from Flutterwave's own API by tx_ref.
 */
export async function POST(request: Request) {
  if (!verifyWebhookHash(request.headers.get('verif-hash'))) {
    return NextResponse.json({ error: 'Invalid hash.' }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      tx_ref?: string;
      status?: string;
      meta?: { orderId?: string } | null;
    };
  };

  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }

  const reference = event.data?.tx_ref;
  if (!reference) {
    // Acknowledge so Flutterwave stops retrying something we can never match.
    return NextResponse.json({ received: true, ignored: 'no tx_ref' });
  }

  /*
   * Ask Flutterwave what really happened rather than believing the payload.
   * Note the status word: Flutterwave says "successful", Paystack said
   * "success" — checking for the wrong one silently drops every paid order.
   */
  let verification;
  try {
    verification = await verifyByReference(reference);
  } catch (err) {
    // Could not confirm — 500 so it is retried rather than silently lost.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed.' },
      { status: 500 }
    );
  }

  if (verification.status !== 'successful') {
    return NextResponse.json({ received: true, status: verification.status });
  }

  const orderId =
    (verification.metadata as { orderId?: string } | null)?.orderId ?? event.data?.meta?.orderId;

  if (!orderId) {
    return NextResponse.json({ error: 'No orderId in metadata.' }, { status: 400 });
  }

  try {
    const result = await markOrderPaid({
      orderId,
      provider: 'FLUTTERWAVE',
      reference: verification.reference,
      amountMinor: verification.amountMinor,
      currency: verification.currency,
      feeMinor: verification.feeMinor,
      raw: verification,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // Return 500 so Flutterwave retries — losing a paid order is unacceptable.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed.' },
      { status: 500 }
    );
  }
}
