import { NextResponse } from 'next/server';
import { capturePaypalOrder } from '@/lib/payments/paypal';
import { markOrderPaid } from '@/lib/orders';

/**
 * PayPal return URL. PayPal sends the buyer back here with ?token=<orderId>
 * after approval; the funds are only actually taken when we capture.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paypalOrderId = url.searchParams.get('token');
  const orderId = url.searchParams.get('orderId');
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400').replace(/\/$/, '');

  if (!paypalOrderId || !orderId) {
    return NextResponse.redirect(`${site}/checkout?error=missing_reference`);
  }

  try {
    const capture = await capturePaypalOrder(paypalOrderId);

    if (capture.status !== 'COMPLETED') {
      return NextResponse.redirect(`${site}/checkout?error=payment_not_completed`);
    }

    await markOrderPaid({
      orderId,
      provider: 'PAYPAL',
      reference: capture.captureId,
      amountMinor: capture.amountMinorUsd,
      currency: 'USD',
      feeMinor: capture.feeMinorUsd,
      raw: capture.raw,
    });

    return NextResponse.redirect(`${site}/checkout/confirm?paypal=1&order=${orderId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'capture_failed';
    return NextResponse.redirect(`${site}/checkout?error=${encodeURIComponent(message)}`);
  }
}
