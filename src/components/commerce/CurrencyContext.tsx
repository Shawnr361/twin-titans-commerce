'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CurrencyOption {
  code: string;
  symbol: string;
  /** Units of this currency per 1 unit of the store's base currency. */
  rate: number;
}

const STORAGE_KEY = 'tt_currency';

interface CurrencyState {
  active: string;
  baseCurrency: string;
  options: CurrencyOption[];
  setActive: (code: string) => void;
}

const CurrencyCtx = createContext<CurrencyState | null>(null);

/**
 * Display currency, held in React state.
 *
 * WHY THIS REPLACED A DOM REWRITER
 * --------------------------------
 * The switcher used to walk `.tt-price` elements and rewrite their text:
 * `node.textContent = ''` followed by `append(...)`. That destroys the text
 * node React created and puts a new one in its place, so React's reconciler is
 * left holding a reference to a node that is no longer in the document. The
 * next time a price changed — choosing a product variant — React dutifully
 * updated the DETACHED node and the shopper carried on seeing the old figure.
 *
 * Observed live: selecting "F260 white" left `data-base-minor` correct at
 * 2499900 while the page still read ₦38,999. A shopper could pick a dearer
 * variant, be shown a cheaper price, and be charged the real one — which is
 * both a broken promise and the sort of thing the terms page has to defend.
 *
 * Holding the currency in context means React renders the text itself, so a
 * price cannot be stale: there is no second writer. It also makes the desktop
 * and mobile switchers agree, which two independent DOM walkers did not.
 */
export function CurrencyProvider({
  options,
  baseCurrency,
  geoCurrency,
  children,
}: {
  options: CurrencyOption[];
  baseCurrency: string;
  /**
   * Suggested from the visitor's country by the CDN in front of the app, or
   * null when that is unknown. Ranks BELOW a saved choice and above the
   * browser-locale guess — see the effect.
   */
  geoCurrency?: string | null;
  children: React.ReactNode;
}) {
  /*
   * Always start on the base currency. The stored preference is applied after
   * mount instead of during the first render, because the server cannot know
   * it — rendering anything else here would be a hydration mismatch.
   */
  const [active, setActiveState] = useState(baseCurrency);

  useEffect(() => {
    let chosen: string | null = null;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && options.some((o) => o.code === stored)) chosen = stored;
    } catch {
      // Private browsing can throw on access; the base currency is fine.
    }

    /*
     * Country beats locale: a Nigerian shopper on an en-GB phone is in Nigeria,
     * not Britain, and language has never been a reliable proxy for where
     * somebody is. It still loses to an explicit choice above.
     */
    if (!chosen && geoCurrency && options.some((o) => o.code === geoCurrency)) {
      chosen = geoCurrency;
    }

    if (!chosen) {
      // Locale fallback — used when the CDN did not tell us the country.
      try {
        const region = new Intl.Locale(navigator.language).maximize().region;
        const byRegion: Record<string, string> = {
          US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'AUD',
          IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
          NL: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR',
          ZA: 'ZAR', GH: 'GHS',
        };
        const suggested = region ? byRegion[region] : undefined;
        if (suggested && options.some((o) => o.code === suggested)) chosen = suggested;
      } catch {
        // Intl.Locale is unavailable on some older browsers.
      }
    }

    if (chosen) setActiveState(chosen);
  }, [options, geoCurrency]);

  const setActive = useCallback((code: string) => {
    setActiveState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // A preference we cannot persist is still worth honouring this visit.
    }
  }, []);

  const value = useMemo(
    () => ({ active, baseCurrency, options, setActive }),
    [active, baseCurrency, options, setActive]
  );

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

/**
 * Current display currency.
 *
 * Returns null outside a provider so a Price can still render its base value —
 * a missing provider must not blank out every price on the page.
 */
export function useCurrency(): CurrencyState | null {
  return useContext(CurrencyCtx);
}
