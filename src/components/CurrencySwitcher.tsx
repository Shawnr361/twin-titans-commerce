'use client';

import { useEffect, useState } from 'react';

/**
 * Display-currency switcher.
 *
 * Rewrites the text of every `.tt-price` element, reading the untouched value
 * from `data-base-minor` each time — so switching back and forth can never
 * compound a conversion, and any other script reading a price still sees the
 * real one.
 *
 * Checkout is ALWAYS in base currency (or USD for PayPal). This is presentation
 * only, and the UI says so, so it never reads as inconsistent pricing.
 */

const SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
};

const STORAGE_KEY = 'tt_currency';

export function CurrencySwitcher({
  currencies,
  baseCurrency,
  rates,
}: {
  currencies: string[];
  baseCurrency: string;
  rates: Record<string, number>;
}) {
  const [selected, setSelected] = useState(baseCurrency);
  const [open, setOpen] = useState(false);

  // Restore the visitor's own choice; it outranks any auto-detection.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved && currencies.includes(saved)) setSelected(saved);
  }, [currencies]);

  useEffect(() => {
    const apply = () => {
      const rate = rates[selected] ?? 1;
      const symbol = SYMBOLS[selected] ?? selected + ' ';
      const decimals = selected === 'NGN' ? 0 : 2;

      document.querySelectorAll<HTMLElement>('.tt-price').forEach((el) => {
        const baseMinor = Number(el.dataset.baseMinor);
        if (!Number.isFinite(baseMinor)) return;

        if (selected === baseCurrency) {
          // Restore exactly what the server rendered.
          if (el.dataset.ttOriginalText) el.textContent = el.dataset.ttOriginalText;
          return;
        }
        if (!el.dataset.ttOriginalText) el.dataset.ttOriginalText = el.textContent ?? '';

        const converted = (baseMinor / 100) * rate;
        el.textContent =
          symbol +
          converted.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
      });
    };

    apply();

    // Cart drawers, variant switches and lazy sections render prices after this
    // effect runs, so re-apply whenever new nodes appear.
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.addedNodes.length > 0)) apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selected, rates, baseCurrency]);

  const choose = (code: string) => {
    setSelected(code);
    localStorage.setItem(STORAGE_KEY, code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chip hover:border-accent/60 hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Display currency: ${selected}`}
      >
        <span aria-hidden>{SYMBOLS[selected] ?? ''}</span>
        {selected}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-panel shadow-card"
        >
          {currencies.map((code) => (
            <button
              key={code}
              role="option"
              aria-selected={code === selected}
              onClick={() => choose(code)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-white/5 ${
                code === selected ? 'text-accent2' : 'text-mut'
              }`}
            >
              <span>
                {SYMBOLS[code] ?? ''} {code}
              </span>
              {code === baseCurrency && <span className="text-[10px] uppercase">charged in</span>}
            </button>
          ))}
          <p className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-mut/80">
            Same value, shown in your currency. Checkout is charged in {baseCurrency} or USD.
          </p>
        </div>
      )}
    </div>
  );
}
