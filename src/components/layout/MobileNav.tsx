"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconChevronRight,
  IconClose,
  IconMenu,
  IconTruck,
} from "@/components/icons";
import {
  CurrencySwitcher,
  type CurrencyOption,
} from "@/components/commerce/CurrencySwitcher";

/**
 * Mobile navigation drawer.
 *
 * A full-height slide-in rather than a horizontal scroll strip: on a phone,
 * departments hidden off the right edge of a scroller are effectively
 * invisible, and the strip competed with vertical page scroll.
 *
 * Same discipline as the bag drawer — focus trapped, Escape closes, background
 * scroll locked, focus returned on close.
 *
 * IT IS RENDERED INTO document.body, NOT WHERE IT SITS IN THE MARKUP.
 *
 * The trigger button belongs in the header; the panel must not be. The header
 * is `sticky z-50` with a `backdrop-blur`, and backdrop-filter does two things
 * that break a drawer nested inside it:
 *
 *   1. it makes the header a containing block for `position: fixed`, so the
 *      panel is measured against the header's ~110px box rather than the screen;
 *   2. it opens a stacking context, so the panel's z-index can only compete
 *      with the header's own children and never with the page.
 *
 * On iOS Safari that surfaced as the announcement bar and the wordmark painting
 * straight over the open menu — both are animated with 3D transforms, so they
 * are promoted to compositor layers, and a promoted layer wins against a
 * sibling it should sit behind. Reported as "on mobile it covers the slide
 * menu", with the drawer's own close button buried underneath.
 *
 * The bag drawer never had this because it is mounted from the root layout.
 * This one now matches it.
 */
export function MobileNav({
  links,
  storeName,
  currencies = [],
  baseCurrency,
}: {
  links: { href: string; label: string }[];
  storeName: string;
  currencies?: CurrencyOption[];
  baseCurrency?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // document does not exist while this renders on the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
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

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          lastFocused.current = document.activeElement as HTMLElement;
          setOpen(true);
        }}
        aria-label="Open menu"
        aria-expanded={open}
        className="-ml-2 p-2.5 text-greige transition-colors hover:text-onyx lg:hidden"
      >
        <IconMenu size={20} />
      </button>

      {mounted &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(false)}
              aria-hidden
              className={`fixed inset-0 z-[60] bg-onyx/25 transition-opacity duration-2 ease-ease lg:hidden ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />

            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`fixed left-0 top-0 z-[61] flex h-[100dvh] w-full max-w-[20rem] flex-col bg-bone transition-transform duration-3 ease-ease lg:hidden ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between border-b border-rule px-6 py-5">
                <span className="label">{storeName}</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="-mr-2 p-2.5 text-greige transition-colors hover:text-onyx"
                >
                  <IconClose size={20} />
                </button>
              </div>

              <nav
                aria-label="Departments"
                className="flex-1 overflow-y-auto overscroll-contain"
              >
                <ul className="divide-y divide-rule">
                  <li>
                    <Link
                      href="/collections/all"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <span className="font-display text-d2 text-onyx">
                        Shop all
                      </span>
                      <IconChevronRight size={16} className="text-quiet" />
                    </Link>
                  </li>
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-4 px-6 py-4"
                      >
                        <span className="text-body text-onyx">{l.label}</span>
                        <IconChevronRight size={16} className="text-quiet" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/*
               * The switcher lives here on phones. In the header bar it was hidden
               * below 640px — there is no room beside the wordmark and the icons —
               * so a shopper on a phone had no way to change currency at all. The
               * drawer has the space, and this is where they already look for
               * settings-shaped things.
               */}
              {currencies.length > 1 && baseCurrency && (
                <div className="flex items-center justify-between gap-4 border-t border-rule px-6 py-4">
                  <span className="label text-greige">Currency</span>
                  <CurrencySwitcher
                    options={currencies}
                    baseCurrency={baseCurrency}
                  />
                </div>
              )}

              <div className="border-t border-rule px-6 py-5">
                <Link
                  href="/orders/track"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 text-label text-greige"
                >
                  <IconTruck size={17} />
                  Track an order
                </Link>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
