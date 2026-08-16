'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconGlobe } from '@/components/icons';

export interface CurrencyOption {
  code: string;
  symbol: string;
  /** Units of this currency per 1 unit of the store's base currency. */
  rate: number;
}

const STORAGE_KEY = 'tt_currency';

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
  const [active, setActive] = useState(baseCurrency);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const applyCurrency = useCallback(
    (code: string) => {
      const option = options.find((o) => o.code === code);
      const nodes = document.querySelectorAll<HTMLElement>('.tt-price');

      nodes.forEach((node) => {
        const baseMinor = Number(node.dataset.baseMinor);
        const base = node.dataset.baseCurrency ?? baseCurrency;
        if (!Number.isFinite(baseMinor)) return;

        // Preserve any prefix ("From ") that the Price component rendered.
        const prefix = node.querySelector('span');
        const prefixText = prefix?.textContent ?? '';

        if (!option || code === base) {
          node.textContent = '';
          if (prefixText) {
            const span = document.createElement('span');
            span.className = 'text-quiet';
            span.textContent = prefixText;
            node.appendChild(span);
          }
          node.append(
            new Intl.NumberFormat('en-NG', {
              style: 'currency',
              currency: base,
              maximumFractionDigits: 0,
            }).format(baseMinor / 100)
          );
          return;
        }

        const converted = (baseMinor / 100) * option.rate;
        node.textContent = '';
        if (prefixText) {
          const span = document.createElement('span');
          span.className = 'text-quiet';
          span.textContent = prefixText;
          node.appendChild(span);
        }
        node.append(
          new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: option.code,
            maximumFractionDigits: converted >= 100 ? 0 : 2,
          }).format(converted)
        );
      });
    },
    [options, baseCurrency]
  );

  // Restore the visitor's choice, or suggest one from their locale.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && options.some((o) => o.code === stored)) {
      setActive(stored);
      applyCurrency(stored);
      return;
    }

    // Locale-based suggestion — no third-party geo-IP request, no tracking.
    const region = new Intl.Locale(navigator.language).maximize().region;
    const byRegion: Record<string, string> = {
      US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'AUD',
      IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
      NL: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR',
      ZA: 'USD', GH: 'USD', KE: 'USD',
    };
    const suggested = region ? byRegion[region] : undefined;
    if (suggested && options.some((o) => o.code === suggested)) {
      setActive(suggested);
      applyCurrency(suggested);
    }
  }, [options, applyCurrency]);

  /*
   * Prices arrive after navigation and inside newly opened drawers, so a
   * one-shot pass is not enough. This re-applies to any price element added
   * later — the failure mode otherwise is a cart drawer showing naira while
   * the page shows dollars.
   */
  useEffect(() => {
    const observer = new MutationObserver((records) => {
      const touched = records.some((r) =>
        Array.from(r.addedNodes).some(
          (n) => n instanceof HTMLElement && (n.matches?.('.tt-price') || n.querySelector?.('.tt-price'))
        )
      );
      if (touched) applyCurrency(active);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, applyCurrency]);

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
    setActive(code);
    window.localStorage.setItem(STORAGE_KEY, code);
    applyCurrency(code);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change currency, currently ${active}`}
        className="flex items-center gap-1.5 py-2 text-label text-greige transition-colors hover:text-onyx"
      >
        <IconGlobe size={17} />
        <span className="tabular-nums">{active}</span>
        <IconChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Currency"
          className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] border border-ruleStrong bg-paper py-1 shadow-lift"
        >
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              role="option"
              aria-selected={o.code === active}
              onClick={() => choose(o.code)}
              className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-label transition-colors hover:bg-bone2 ${
                o.code === active ? 'text-onyx' : 'text-greige'
              }`}
            >
              <span>
                <span className="tabular-nums">{o.code}</span>
                <span className="ml-2 text-quiet">{o.symbol}</span>
              </span>
              {o.code === active && <IconGlobe size={14} />}
            </button>
          ))}

          <p className="border-t border-rule px-4 pb-1 pt-3 text-micro leading-relaxed text-quiet">
            Shown for convenience. You are charged in {baseCurrency} at checkout.
          </p>
        </div>
      )}
    </div>
  );
}
