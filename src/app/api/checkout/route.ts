import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hydrateCart, readCart } from '@/lib/cart';
import { getRate } from '@/lib/fx';
import { convertMinor } from '@/lib/money';
import { createOrder } from '@/lib/orders';
import { createPaypalOrder, isPaypalConfigured } from '@/lib/payments/paypal';
import { initTransaction, isPaystackConfigured } from '@/lib/payments/paystack';
import { getStoreSettings } from '@/lib/settings';

const schema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  method: z.enum(['PAYSTACK', 'PAYPAL']),
  note: z.string().max(500).optional(),
  shippingAddress: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().min(1),
  }),
});

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400').replace(/\/$/, '');
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please fill in every required field with valid details.' },
      { status: 400 }
    );
  }

  // Re-hydrate from the cookie so the amount charged is derived from the
  // database, never from anything the browser sent.
  const cart = await hydrateCart(await readCart());
  if (cart.itemCount === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }

  const settings = await getStoreSettings();
  const { method, ...rest } = parsed.data;

  const order = await createOrder({
    cart,
    email: rest.email,
    phone: rest.phone,
    shippingAddress: rest.shippingAddress,
    note: rest.note,
  });

  const reference = `TT-${order.number}-${Date.now().toString(36).toUpperCase()}`;

  try {
    if (method === 'PAYSTACK') {
      if (!isPaystackConfigured()) {
        return NextResponse.json({ error: 'Card payment is not available yet.' }, { status: 503 });
      }

      const init = await initTransaction({
        email: order.email,
        amountMinor: order.totalMinor,
        reference,
        currency: settings.baseCurrency,
        callbackUrl: `${siteUrl()}/checkout/confirm?ref=${encodeURIComponent(reference)}`,
        metadata: { orderId: order.id, orderNumber: order.number },
      });

      return NextResponse.json({ redirectUrl: init.authorization_url, reference });
    }

    if (!isPaypalConfigured()) {
      return NextResponse.json({ error: 'PayPal is not available yet.' }, { status: 503 });
    }

    // PayPal cannot process NGN at all, so the order is presented in USD.
    /*
     * getRate returns null for an unknown code rather than 1. Converting at 1.0
     * would bill a ₦50,000 order as $50,000, and the <= 0 check below would not
     * catch it because the number is large and positive.
     */
    const usdRate = await getRate('USD');
    if (usdRate == null || usdRate <= 0) {
      return NextResponse.json(
        { error: 'Could not convert your order total to USD. Please use card payment.' },
        { status: 503 }
      );
    }
    const amountUsdMinor = convertMinor(order.totalMinor, settings.baseCurrency, 'USD', usdRate);

    if (amountUsdMinor <= 0) {
      return NextResponse.json(
        { error: 'Could not convert your order total to USD. Please use card payment.' },
        { status: 500 }
      );
    }

    const paypalOrder = await createPaypalOrder({
      amountMinorUsd: amountUsdMinor,
      reference,
      description: `Order ${order.number}`,
      returnUrl: `${siteUrl()}/api/payments/paypal/capture?ref=${encodeURIComponent(reference)}&orderId=${order.id}`,
      cancelUrl: `${siteUrl()}/checkout?cancelled=1`,
    });

    const approve = paypalOrder.links?.find((l) => l.rel === 'approve')?.href;
    if (!approve) throw new Error('PayPal did not return an approval link.');

    return NextResponse.json({ redirectUrl: approve, reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment could not be started.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
