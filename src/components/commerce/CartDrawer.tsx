'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HydratedCart } from '@/lib/cart';
import { IconBag, IconClose, IconMinus, IconPlus, IconTrash } from '@/components/icons';
import { Price } from './Price';

/** Anything can open the drawer without prop-drilling a setter through the tree. */
export const CART_OPEN_EVENT = 'tt:cart-open';
export const CART_CHANGED_EVENT = 'tt:cart-changed';

export function openCartDrawer() {
  window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
}

/**
 * Slide-over bag.
 *
 * Opening the bag instead of navigating to /cart keeps the customer on the
 * page they were shopping — the single highest-impact change to add-to-cart
 * flow. /cart still exists and still works, for anyone who lands there
 * directly or has JS disabled.
 *
 * Focus is trapped while open, Escape closes, and background scroll is locked.
 */
export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<HydratedCart | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cart');
      if (res.ok) setCart(await res.json());
    } catch {
      /* the drawer simply shows its previous state */
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      lastFocused.current = document.activeElement as HTMLElement;
      setOpen(true);
      load();
    };
    const onChanged = () => load();

    window.addEventListener(CART_OPEN_EVENT, onOpen);
    window.addEventListener(CART_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(CART_OPEN_EVENT, onOpen);
      window.removeEventListener(CART_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  // Escape to close, and keep Tab inside the panel while it is open.
  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  const update = async (variantId: string, quantity: number) => {
    setBusyLine(variantId);
    try {
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId, quantity }),
      });
      if (res.ok) setCart(await res.json());
    } finally {
      setBusyLine(null);
    }
  };

  const gap = cart?.freeShippingOverMinor
    ? cart.freeShippingOverMinor - cart.subtotalMinor
    : 0;
  const progress = cart?.freeShippingOverMinor
    ? Math.min(100, (cart.subtotalMinor / cart.freeShippingOverMinor) * 100)
    : 0;

  return (
    <>
      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-onyx/25 transition-opacity duration-2 ease-ease ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        className={`fixed right-0 top-0 z-[61] flex h-[100dvh] w-full max-w-[27rem] flex-col bg-bone transition-transform duration-3 ease-ease ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-rule px-6 py-5">
          <h2 className="flex items-center gap-2.5 text-label text-onyx">
            <IconBag size={18} />
            Your bag
            {cart ? <span className="text-quiet tabular-nums">({cart.itemCount})</span> : null}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close bag"
            className="-mr-2 p-2.5 text-greige transition-colors hover:text-onyx"
          >
            <IconClose size={20} />
          </button>
        </header>

        {cart && cart.freeShippingOverMinor > 0 && cart.itemCount > 0 && (
          <div className="border-b border-rule px-6 py-4">
            {gap > 0 ? (
              <p className="text-label !normal-case !tracking-normal text-greige">
                <Price minor={gap} currency={cart.currency} className="text-onyx" /> from
                complimentary delivery
              </p>
            ) : (
              <p className="text-label !normal-case !tracking-normal text-verdigris">
                Complimentary delivery applied
              </p>
            )}
            <div className="mt-2.5 h-px w-full bg-rule">
              <div
                className="h-px bg-onyx transition-[width] duration-3 ease-ease"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-6">
          {!cart || cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <IconBag size={36} className="text-quiet" />
              <p className="text-body text-greige">Your bag is empty.</p>
              <button type="button" onClick={() => setOpen(false)} className="link text-label">
                Continue shopping
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {cart.lines.map((line) => (
                <li
                  key={line.variantId}
                  className={`flex gap-4 py-5 transition-opacity duration-2 ${
                    busyLine === line.variantId ? 'opacity-50' : ''
                  }`}
                >
                  <Link
                    href={`/products/${line.productHandle}`}
                    onClick={() => setOpen(false)}
                    className="media aspect-product w-20 shrink-0"
                  >
                    {line.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.imageUrl} alt="" loading="lazy" />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link
                      href={`/products/${line.productHandle}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 text-label !normal-case !tracking-normal text-onyx"
                    >
                      {line.productTitle}
                    </Link>
                    {line.variantTitle !== 'Default' && (
                      <p className="text-micro text-quiet">{line.variantTitle}</p>
                    )}

                    <div className="mt-auto flex items-center gap-3 pt-2">
                      <div className="flex items-center border border-ruleStrong">
                        <button
                          type="button"
                          onClick={() => update(line.variantId, line.quantity - 1)}
                          aria-label={`Decrease quantity of ${line.productTitle}`}
                          className="px-2 py-1.5 text-greige transition-colors hover:text-onyx"
                        >
                          <IconMinus size={13} />
                        </button>
                        <span className="min-w-6 text-center text-micro tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => update(line.variantId, line.quantity + 1)}
                          aria-label={`Increase quantity of ${line.productTitle}`}
                          className="px-2 py-1.5 text-greige transition-colors hover:text-onyx"
                        >
                          <IconPlus size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => update(line.variantId, 0)}
                        aria-label={`Remove ${line.productTitle}`}
                        className="p-2 text-quiet transition-colors hover:text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>

                  <Price
                    minor={line.lineTotalMinor}
                    currency={cart.currency}
                    className="text-label text-onyx"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.lines.length > 0 && (
          <footer className="border-t border-rule px-6 py-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="label">Subtotal</span>
              <Price
                minor={cart.subtotalMinor}
                currency={cart.currency}
                className="font-display text-d2 text-onyx"
              />
            </div>
            <p className="mt-1 text-micro text-quiet">
              Delivery calculated at checkout. Charged in {cart.currency}.
            </p>

            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="btn btn-primary sheen mt-5 w-full"
            >
              Checkout
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="link mt-4 block text-center text-label"
            >
              View full bag
            </Link>
          </footer>
        )}
      </div>
    </>
  );
}
