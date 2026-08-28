'use client';

import { useState } from 'react';
import type { HydratedCart } from '@/lib/cart';
import { Magnetic } from '@/components/motion/Magnetic';
import { Price } from './Price';

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
  // Which button is mid-flight, so only that one shows a spinner label.
  const [pending, setPending] = useState<'PAYSTACK' | 'PAYPAL' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noPaymentConfigured = !paystackEnabled && !paypalEnabled;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    /*
     * Which button was pressed IS the choice — read from the submitter rather
     * than from state. Setting state in the button's onClick and reading it
     * here races: React batches the update, so the first click would submit
     * the previous method. There is no separate "selected" step to get wrong.
     */
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const chosen: 'PAYSTACK' | 'PAYPAL' =
      submitter?.value === 'PAYPAL' ? 'PAYPAL' : 'PAYSTACK';

    setPending(chosen);
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      method: chosen,
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
      if (!res.ok) throw new Error(body?.error ?? 'Checkout could not be completed.');

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
    <form onSubmit={submit} className="grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
      <div className="space-y-12">
        <fieldset>
          <legend className="label">Contact</legend>
          <hr className="rule mt-4" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">
                Phone
              </label>
              <input id="phone" name="phone" type="tel" required autoComplete="tel" className="field" />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Delivery address</legend>
          <hr className="rule mt-4" />

          <div className="mt-6 space-y-5">
            <div>
              <label className="field-label" htmlFor="name">
                Full name
              </label>
              <input id="name" name="name" required autoComplete="name" className="field" />
            </div>

            <div>
              <label className="field-label" htmlFor="line1">
                Address
              </label>
              <input
                id="line1"
                name="line1"
                required
                autoComplete="address-line1"
                placeholder="House number and street"
                className="field"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="line2">
                Apartment, suite or landmark <span className="text-quiet">(optional)</span>
              </label>
              <input id="line2" name="line2" autoComplete="address-line2" className="field" />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  required
                  autoComplete="address-level2"
                  className="field"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="state">
                  State
                </label>
                <input id="state" name="state" autoComplete="address-level1" className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="postcode">
                  Postcode
                </label>
                <input
                  id="postcode"
                  name="postcode"
                  autoComplete="postal-code"
                  className="field"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="country">
                Country
              </label>
              <select id="country" name="country" defaultValue="Nigeria" className="field">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="note">
                Delivery note <span className="text-quiet">(optional)</span>
              </label>
              <textarea id="note" name="note" rows={2} className="field resize-none" />
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="h-fit lg:sticky lg:top-28">
        <h2 className="label">Your order</h2>
        <hr className="rule-gold mt-4" />

        <ul className="mt-6 space-y-4">
          {cart.lines
            .filter((l) => l.available)
            .map((line) => (
              <li key={line.variantId} className="flex gap-4">
                <div className="media aspect-product relative w-16 shrink-0">
                  {line.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" loading="lazy" />
                  )}
                  <span className="absolute -right-2 -top-2 z-[2] grid h-5 min-w-5 place-items-center bg-onyx px-1 text-micro tabular-nums text-bone">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-label !normal-case !tracking-normal text-onyx">
                    {line.productTitle}
                  </p>
                  {line.variantTitle !== 'Default' && (
                    <p className="text-micro text-quiet">{line.variantTitle}</p>
                  )}
                </div>
                <Price
                  minor={line.lineTotalMinor}
                  currency={cart.currency}
                  className="text-label text-onyx"
                />
              </li>
            ))}
        </ul>

        <dl className="mt-8 space-y-3 border-t border-rule pt-6 text-body">
          <div className="flex justify-between gap-4">
            <dt className="text-greige">Subtotal</dt>
            <dd>
              <Price minor={cart.subtotalMinor} currency={cart.currency} />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-greige">Delivery</dt>
            <dd>
              {cart.shippingMinor === 0 ? (
                <span className="text-verdigris">Complimentary</span>
              ) : (
                <Price minor={cart.shippingMinor} currency={cart.currency} />
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-rule pt-4">
            <dt className="font-display text-d2 text-onyx">Total</dt>
            <dd>
              <Price
                minor={cart.totalMinor}
                currency={cart.currency}
                className="font-display text-d2 text-onyx"
              />
            </dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="mt-6 border border-danger/40 p-4 text-body text-danger">
            {error}
          </p>
        )}

        {/*
          Under the total, not beside the address form. A shopper commits once they
          have seen what they are being charged, so the button belongs at the
          figure rather than several screens above it.

          Each button now says only its own currency. The longer "use this if you
          bank in Nigeria" line was accurate but crowded the moment of paying, and
          the currency carries the same meaning.
        */}
        {noPaymentConfigured ? (
          <p role="alert" className="mt-8 border border-warn/40 p-4 text-body text-warn">
            No payment provider is configured yet. Add your Paystack or PayPal keys before taking
            real orders.
          </p>
        ) : (
          <div className="mt-8 space-y-3">
            {paystackEnabled && (
              <button
                type="submit"
                name="method"
                value="PAYSTACK"
                disabled={busy}
                className="btn btn-primary sheen w-full !flex-col gap-0.5 !py-3.5 !rounded-full disabled:opacity-60"
              >
                <span className="text-body font-medium">
                  {pending === 'PAYSTACK' ? 'Redirecting…' : 'Pay with Paystack'}
                </span>
                <span className="text-micro !normal-case !tracking-normal opacity-75">
                  Charged in {baseCurrency}
                </span>
              </button>
            )}

            {paypalEnabled && (
              /*
                PayPal's own navy, with the wordmark set in type. Their real mark is
                a trademarked asset from PayPal's brand centre; an approximation
                drawn here would be visibly off and a trademark risk, so the button
                shape is right and the artwork does not pretend to be theirs.
              */
              <button
                type="submit"
                name="method"
                value="PAYPAL"
                disabled={busy}
                className="flex w-full flex-col items-center gap-0.5 rounded-full bg-[#003087] py-3.5 text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <span className="text-body font-medium">
                  {pending === 'PAYPAL' ? (
                    'Redirecting…'
                  ) : (
                    <>
                      Pay with{' '}
                      <span className="font-display italic tracking-tight">
                        <span className="text-white">Pay</span>
                        <span className="text-[#8bc4f0]">Pal</span>
                      </span>
                    </>
                  )}
                </span>
                <span className="text-micro opacity-75">Charged in USD</span>
              </button>
            )}
          </div>
        )}
        <p className="mt-4 text-label text-quiet">
          By ordering you agree to our terms. Tracking follows by email once your parcel ships.
        </p>
      </aside>
    </form>
  );
}
