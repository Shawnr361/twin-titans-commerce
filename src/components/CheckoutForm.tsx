'use client';

import { useState } from 'react';
import type { HydratedCart } from '@/lib/cart';
import { Price } from '@/components/commerce/Price';

const COUNTRIES = [
  'Nigeria',
  'Ghana',
  'Kenya',
  'South Africa',
  'United Kingdom',
  'United States',
  'Canada',
  'Ireland',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Australia',
];

export function CheckoutForm({
  cart,
  baseCurrency,
  paystackEnabled,
  paypalEnabled,
}: {
  cart: HydratedCart;
  baseCurrency: string;
  paystackEnabled: boolean;
  paypalEnabled: boolean;
}) {
  const [method, setMethod] = useState<'PAYSTACK' | 'PAYPAL'>(
    paystackEnabled ? 'PAYSTACK' : 'PAYPAL'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noPaymentConfigured = !paystackEnabled && !paypalEnabled;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      method,
      shippingAddress: {
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        line1: String(form.get('line1') ?? ''),
        line2: String(form.get('line2') ?? ''),
        city: String(form.get('city') ?? ''),
        state: String(form.get('state') ?? ''),
        postcode: String(form.get('postcode') ?? ''),
        country: String(form.get('country') ?? 'Nigeria'),
      },
      note: String(form.get('note') ?? ''),
    };

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Checkout failed.');

      if (body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }
      throw new Error('The payment provider did not return a checkout link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <fieldset className="panel space-y-4 p-6">
          <legend className="px-2 text-sm font-bold uppercase tracking-wide text-mut">
            Contact
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Phone
              </label>
              <input id="phone" name="phone" type="tel" required className="input" autoComplete="tel" />
            </div>
          </div>
        </fieldset>

        <fieldset className="panel space-y-4 p-6">
          <legend className="px-2 text-sm font-bold uppercase tracking-wide text-mut">
            Delivery address
          </legend>

          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input id="name" name="name" required className="input" autoComplete="name" />
          </div>

          <div>
            <label className="label" htmlFor="line1">
              Address
            </label>
            <input
              id="line1"
              name="line1"
              required
              className="input"
              autoComplete="address-line1"
              placeholder="House number and street"
            />
          </div>

          <div>
            <label className="label" htmlFor="line2">
              Apartment, suite, landmark (optional)
            </label>
            <input id="line2" name="line2" className="input" autoComplete="address-line2" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="city">
                City
              </label>
              <input id="city" name="city" required className="input" autoComplete="address-level2" />
            </div>
            <div>
              <label className="label" htmlFor="state">
                State / region
              </label>
              <input id="state" name="state" className="input" autoComplete="address-level1" />
            </div>
            <div>
              <label className="label" htmlFor="postcode">
                Postcode
              </label>
              <input id="postcode" name="postcode" className="input" autoComplete="postal-code" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="country">
              Country
            </label>
            <select id="country" name="country" className="input" defaultValue="Nigeria">
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="note">
              Delivery note (optional)
            </label>
            <textarea id="note" name="note" rows={2} className="input resize-none" />
          </div>
        </fieldset>

        <fieldset className="panel space-y-3 p-6">
          <legend className="px-2 text-sm font-bold uppercase tracking-wide text-mut">
            Payment
          </legend>

          {noPaymentConfigured && (
            <p role="alert" className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-300">
              No payment provider is configured yet. Add your Paystack or PayPal keys in the
              environment before taking real orders.
            </p>
          )}

          {paystackEnabled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input
                type="radio"
                name="method"
                value="PAYSTACK"
                checked={method === 'PAYSTACK'}
                onChange={() => setMethod('PAYSTACK')}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold">Card / Bank transfer / USSD</span>
                <span className="block text-xs text-mut">
                  Secure payment via Paystack, charged in {baseCurrency}.
                </span>
              </span>
            </label>
          )}

          {paypalEnabled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input
                type="radio"
                name="method"
                value="PAYPAL"
                checked={method === 'PAYPAL'}
                onChange={() => setMethod('PAYPAL')}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold">PayPal</span>
                <span className="block text-xs text-mut">
                  {/* PayPal cannot process NGN — this is a platform limit, so say so plainly. */}
                  Charged in USD at today&apos;s rate. Best for international orders.
                </span>
              </span>
            </label>
          )}
        </fieldset>
      </div>

      <aside className="panel h-fit space-y-4 p-6 lg:sticky lg:top-24">
        <h2 className="text-sm font-bold uppercase tracking-wide text-mut">Your order</h2>

        <ul className="space-y-3">
          {cart.lines
            .filter((l) => l.available)
            .map((line) => (
              <li key={line.variantId} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/40">
                  {line.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-medium">{line.productTitle}</p>
                  <p className="text-[11px] text-mut">{line.variantTitle}</p>
                </div>
                <Price
                  minor={line.lineTotalMinor}
                  currency={cart.currency}
                  className="text-xs font-semibold"
                />
              </li>
            ))}
        </ul>

        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-mut">Subtotal</dt>
            <dd>
              <Price minor={cart.subtotalMinor} currency={cart.currency} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-mut">Shipping</dt>
            <dd>
              {cart.shippingMinor === 0 ? (
                <span className="text-accent2">Free</span>
              ) : (
                <Price minor={cart.shippingMinor} currency={cart.currency} />
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>
              <Price minor={cart.totalMinor} currency={cart.currency} />
            </dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || noPaymentConfigured} className="btn-primary w-full">
          {busy ? 'Redirecting to payment…' : 'Pay now'}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-mut">
          By ordering you agree to our terms. You will receive tracking by email once your parcel
          ships.
        </p>
      </aside>
    </form>
  );
}
