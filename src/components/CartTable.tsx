'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { HydratedCart } from '@/lib/cart';
import { Price } from '@/components/commerce/Price';

export function CartTable({ initial }: { initial: HydratedCart }) {
  const [cart, setCart] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const update = async (variantId: string, quantity: number) => {
    const res = await fetch('/api/cart', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId, quantity }),
    });
    if (res.ok) {
      setCart(await res.json());
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-3">
        {cart.lines.map((line) => (
          <div
            key={line.variantId}
            className={`panel flex gap-4 p-4 ${line.available ? '' : 'opacity-60'}`}
          >
            <Link
              href={`/products/${line.productHandle}`}
              className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black/40"
            >
              {line.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </Link>

            <div className="min-w-0 flex-1 space-y-1.5">
              <Link
                href={`/products/${line.productHandle}`}
                className="line-clamp-2 text-sm font-semibold transition hover:text-accent2"
              >
                {line.productTitle}
              </Link>
              {line.variantTitle !== 'Default' && (
                <p className="text-xs text-mut">{line.variantTitle}</p>
              )}
              {line.unavailableReason && (
                <p className="text-xs text-amber-400">{line.unavailableReason}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center rounded-lg border border-line bg-black/30 text-sm">
                  <button
                    type="button"
                    onClick={() => update(line.variantId, line.quantity - 1)}
                    className="px-3 py-1.5 text-mut transition hover:text-ink"
                    aria-label={`Decrease quantity of ${line.productTitle}`}
                  >
                    −
                  </button>
                  <span className="min-w-7 text-center">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => update(line.variantId, line.quantity + 1)}
                    className="px-3 py-1.5 text-mut transition hover:text-ink"
                    aria-label={`Increase quantity of ${line.productTitle}`}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => update(line.variantId, 0)}
                  className="text-xs text-mut underline-offset-2 transition hover:text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="text-right">
              <Price
                minor={line.lineTotalMinor}
                currency={cart.currency}
                className="text-sm font-bold"
              />
            </div>
          </div>
        ))}
      </div>

      <aside className="panel h-fit space-y-4 p-6 lg:sticky lg:top-24">
        <h2 className="text-sm font-bold uppercase tracking-wide text-mut">Order summary</h2>

        <dl className="space-y-2.5 text-sm">
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
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>
              <Price minor={cart.totalMinor} currency={cart.currency} />
            </dd>
          </div>
        </dl>

        <Link
          href="/checkout"
          aria-disabled={cart.itemCount === 0}
          className={`btn-primary w-full ${cart.itemCount === 0 ? 'pointer-events-none opacity-50' : ''}`}
        >
          {pending ? 'Updating…' : 'Proceed to checkout'}
        </Link>

        <p className="text-center text-[11px] leading-relaxed text-mut">
          Prices may be displayed in your local currency. You are charged in {cart.currency}.
        </p>
      </aside>
    </div>
  );
}
