'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { HydratedCart } from '@/lib/cart';
import { Price } from './Price';

export function CartTable({ initial }: { initial: HydratedCart }) {
  const [cart, setCart] = useState(initial);
  const [pendingLine, setPendingLine] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const update = async (variantId: string, quantity: number) => {
    setPendingLine(variantId);
    try {
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId, quantity }),
      });
      if (res.ok) {
        setCart(await res.json());
        startTransition(() => router.refresh());
      }
    } finally {
      setPendingLine(null);
    }
  };

  const freeShippingGap = cart.freeShippingOverMinor
    ? cart.freeShippingOverMinor - cart.subtotalMinor
    : 0;
  const progress = cart.freeShippingOverMinor
    ? Math.min(100, (cart.subtotalMinor / cart.freeShippingOverMinor) * 100)
    : 0;

  return (
    <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
      <div>
        {/* Free-shipping progress — only shown when a threshold is configured. */}
        {cart.freeShippingOverMinor > 0 && (
          <div className="mb-8 border-b border-rule pb-6">
            {freeShippingGap > 0 ? (
              <p className="text-body text-greige">
                You are{' '}
                <Price
                  minor={freeShippingGap}
                  currency={cart.currency}
                  className="font-medium text-onyx"
                />{' '}
                from complimentary delivery.
              </p>
            ) : (
              <p className="text-body text-verdigris">Complimentary delivery applied.</p>
            )}
            <div className="mt-3 h-px w-full bg-rule">
              <div
                className="h-px bg-onyx transition-[width] duration-3 ease-ease"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <ul className="divide-y divide-rule border-y border-rule">
          {cart.lines.map((line) => (
            <li
              key={line.variantId}
              className={`flex gap-5 py-6 transition-opacity duration-2 ${
                pendingLine === line.variantId ? 'opacity-50' : ''
              } ${line.available ? '' : 'opacity-60'}`}
            >
              <Link
                href={`/products/${line.productHandle}`}
                className="media aspect-product w-24 shrink-0 sm:w-28"
              >
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.imageUrl} alt="" loading="lazy" />
                ) : null}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Link
                  href={`/products/${line.productHandle}`}
                  className="text-body font-medium text-onyx transition-colors hover:text-verdigris"
                >
                  {line.productTitle}
                </Link>

                {line.variantTitle !== 'Default' && (
                  <p className="label !normal-case !tracking-normal">{line.variantTitle}</p>
                )}

                {line.unavailableReason && (
                  <p className="text-label text-warn">{line.unavailableReason}</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center border border-ruleStrong">
                    <button
                      type="button"
                      onClick={() => update(line.variantId, line.quantity - 1)}
                      className="px-3 py-1.5 text-greige transition-colors hover:text-onyx"
                      aria-label={`Decrease quantity of ${line.productTitle}`}
                    >
                      −
                    </button>
                    <span className="min-w-7 text-center text-label tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => update(line.variantId, line.quantity + 1)}
                      className="px-3 py-1.5 text-greige transition-colors hover:text-onyx"
                      aria-label={`Increase quantity of ${line.productTitle}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => update(line.variantId, 0)}
                    className="link text-label !text-greige"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <Price
                minor={line.lineTotalMinor}
                currency={cart.currency}
                className="text-body font-medium text-onyx"
              />
            </li>
          ))}
        </ul>

        <Link href="/collections/all" className="link mt-8 inline-block text-label">
          Continue shopping
        </Link>
      </div>

      <aside className="h-fit lg:sticky lg:top-28">
        <h2 className="label">Summary</h2>
        <hr className="rule-gold mt-4" />

        <dl className="mt-6 space-y-3 text-body">
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

        <Link
          href="/checkout"
          aria-disabled={cart.itemCount === 0}
          className={`btn btn-primary sheen mt-8 w-full ${
            cart.itemCount === 0 ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          Checkout
        </Link>

        <p className="mt-4 text-label text-quiet">
          Charged in {cart.currency}. Taxes and duties, where they apply, are calculated at
          checkout.
        </p>
      </aside>
    </div>
  );
}
