'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconChevronDown, IconGlobe } from '@/components/icons';
import { useCurrency, type CurrencyOption } from './CurrencyContext';

export type { CurrencyOption } from './CurrencyContext';


/**
 * Flag per currency, as a regional-indicator pair.
 *
 * Emoji rather than image assets: no requests, no CDN, scales with the type,
 * and renders from the system font on every modern platform. Windows draws
 * these as letter pairs rather than flags, which still reads correctly as a
 * country mark, so the currency code beside it always carries the real meaning.
 */
const FLAG: Record<string, string> = {
  NGN: '🇳🇬',
  USD: '🇺🇸',
  GBP: '🇬🇧',
  EUR: '🇪🇺',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  CNY: '🇨🇳',
  ZAR: '🇿🇦',
  GHS: '🇬🇭',
  KES: '🇰🇪',
  AED: '🇦🇪',
  JPY: '🇯🇵',
  INR: '🇮🇳',
};

/**
 * Display-currency switcher for international shoppers.
 *
 * THE RULE THAT MATTERS: this rewrites the *displayed text* of price elements
 * only. The true value stays in `data-base-minor` / `data-base-currency`,
 * written by the Price component and never touched here. Any code that needs a
 * real number — a payment button, analytics, a total — reads the attribute.
 *
 * On the previous store a payment button read the *visible text* of the same
 * elements a converter rewrote, so switching currency would have made it
 * charge a converted figure as though it were raw naira. Converting display
 * and settlement are different problems and this component only does the first.
 *
 * Settlement never changes: checkout always charges the base currency, and the
 * UI says so wherever a converted price is shown.
 */
export function CurrencySwitcher({
  options,
  baseCurrency,
}: {
  options: CurrencyOption[];
  baseCurrency: string;
}) {
  const ctx = useCurrency();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  /*
   * The currency lives in context now, not in this component and not in the
   * DOM. This control only reads and sets it — see CurrencyContext for why
   * rewriting price text in place was unsafe.
   */
  const active = ctx?.active ?? baseCurrency;
  const setActive = ctx?.setActive;

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (code: string) => {
    setActive?.(code);
    setOpen(false);
  };

  /*
   * Open upward when there is not enough room below.
   *
   * The menu was pinned to top-full, which is fine in the header but wrong in
   * the mobile drawer, where the switcher sits at the very bottom: the list
   * opened downward into the fold and only the first two currencies were
   * reachable. Measured on open rather than guessed from a breakpoint, so it
   * stays correct wherever this control is placed.
   */
  const [dropUp, setDropUp] = useState(false);

  const toggle = () => {
    setOpen((wasOpen) => {
      if (!wasOpen && wrapRef.current) {
        const { bottom } = wrapRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - bottom;
        // Roughly the menu's height; flip when it would not clear the fold.
        setDropUp(spaceBelow < Math.min(options.length * 40 + 16, 280));
      }
      return !wasOpen;
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change currency, currently ${active}`}
        className="flex items-center gap-1.5 py-2 text-label text-greige transition-colors hover:text-onyx"
      >
        <span aria-hidden className="text-[0.95rem] leading-none">
          {FLAG[active] ?? <IconGlobe size={17} />}
        </span>
        <span className="tabular-nums">{active}</span>
        <IconChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Currency"
          className={`absolute right-0 z-50 max-h-[60vh] min-w-[13rem] overflow-y-auto border border-ruleStrong bg-paper py-1 shadow-lift ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              role="option"
              aria-selected={o.code === active}
              onClick={() => choose(o.code)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-label transition-colors hover:bg-bone2 ${
                o.code === active ? 'text-onyx' : 'text-greige'
              }`}
            >
              {/* Fixed-width columns so codes and symbols align down the list. */}
              <span aria-hidden className="w-5 shrink-0 text-center text-[1rem] leading-none">
                {FLAG[o.code] ?? '🌐'}
              </span>
              <span className="w-10 shrink-0 tabular-nums">{o.code}</span>
              <span className="flex-1 text-quiet">{o.symbol}</span>
              {o.code === active && <IconCheck size={15} className="shrink-0 text-verdigris" />}
            </button>
          ))}

          {/*
            Display currency and settlement currency are different things, so
            this names the two payment routes exactly as the checkout buttons
            do, with the currency each one charges in.

            "By card" was the old wording and it read as a limitation. It is
            the charge CURRENCY that is fixed at NGN, not the card: Flutterwave
            accepts international cards, and a foreign bank simply converts.
            Naming the provider instead of the instrument avoids implying that
            an overseas customer cannot pay this way.
          */}
          <p className="border-t border-rule px-4 pb-1 pt-3 text-micro leading-relaxed text-quiet">
            Shown for convenience. At checkout you pay with Flutterwave in {baseCurrency}, or with
            PayPal in USD.
          </p>
        </div>
      )}
    </div>
  );
}
