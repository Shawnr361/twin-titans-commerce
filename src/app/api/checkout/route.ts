import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hydrateCart, readCart } from '@/lib/cart';
import { getRate } from '@/lib/fx';
import { convertMinor } from '@/lib/money';
import { createOrder } from '@/lib/orders';
import { createPaypalOrder, isPaypalConfigured } from '@/lib/payments/paypal';
import { createPaymentLink, isFlutterwaveConfigured } from '@/lib/payments/flutterwave';
import { getStoreSettings } from '@/lib/settings';
import { saveAttribution } from '@/lib/tracking';
import { cookies, headers } from 'next/headers';

const schema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  method: z.enum(['FLUTTERWAVE', 'PAYPAL']),
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
  // database, never from anything the browser sent. Delivery is priced for the
  // country actually submitted — overseas orders carry their own rate.
  const cart = await hydrateCart(await readCart(), parsed.data.shippingAddress.country);
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

  /*
   * Freeze the ad click identifiers onto the order, right now.
   *
   * This request is the LAST point where the shopper's cookies and IP are
   * visible. The Purchase event is sent from a payment webhook, which is a
   * server-to-server call from Flutterwave carrying none of them — so without
   * this the conversion reaches Meta and TikTok with no click id and cannot be
   * attributed to the ad that produced it.
   *
   * Deliberately not awaited into the critical path beyond its own failure
   * handling: saveAttribution swallows its errors, because losing attribution
   * is a reporting problem and failing a checkout is a revenue one.
   */
  const [jar, hdrs] = await Promise.all([cookies(), headers()]);
  await saveAttribution(order.id, {
    fbp: jar.get('_fbp')?.value,
    fbc: jar.get('_fbc')?.value,
    ttp: jar.get('_ttp')?.value,
    ttclid: jar.get('ttclid')?.value,
    userAgent: hdrs.get('user-agent') ?? undefined,
    // Cloudflare sits in front of this app, so the socket address is Cloudflare's.
    ip:
      hdrs.get('cf-connecting-ip') ??
      hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined,
    sourceUrl: `${siteUrl()}/checkout`,
  });

  const reference = `TT-${order.number}-${Date.now().toString(36).toUpperCase()}`;

  try {
    if (method === 'FLUTTERWAVE') {
      if (!isFlutterwaveConfigured()) {
        return NextResponse.json({ error: 'Card payment is not available yet.' }, { status: 503 });
      }

      /*
       * amountMinor stays in MINOR units here. The adapter converts to the
       * major units Flutterwave expects — doing it at the call site is how a
       * ₦35,997 order becomes a ₦3,599,700 charge.
       */
      const init = await createPaymentLink({
        email: order.email,
        name: rest.shippingAddress.name,
        phone: rest.phone ?? rest.shippingAddress.phone,
        amountMinor: order.totalMinor,
        reference,
        currency: settings.baseCurrency,
        storeName: settings.storeName,
        /*
         * No query string of ours: Flutterwave appends its own status, tx_ref
         * and transaction_id to this URL, and the confirm page reads those.
         */
        redirectUrl: `${siteUrl()}/checkout/confirm`,
        metadata: { orderId: order.id, orderNumber: order.number },
      });

      return NextResponse.json({ redirectUrl: init.link, reference });
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
      /*
       * Itemised so PayPal's receipt names what was bought. Each line is
       * converted with the SAME rate as the total, so the two agree — PayPal
       * refuses an order whose items do not sum to the amount.
       */
      items: order.lineItems.map((line) => ({
        name: line.productTitle,
        quantity: line.quantity,
        unitMinorUsd: convertMinor(line.unitPriceMinor, settings.baseCurrency, 'USD', usdRate),
      })),
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
