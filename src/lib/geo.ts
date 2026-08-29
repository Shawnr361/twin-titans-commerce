/**
 * Country -> display currency.
 *
 * DISPLAY ONLY. Flutterwave charges in the store's base currency and PayPal in
 * USD, whatever a visitor is shown. Suggesting a currency is a courtesy; it
 * must never read as a promise about what a card will be billed, because the
 * terms page commits the store to accurate pricing information.
 *
 * A country that is not listed returns null rather than guessing. Falling back
 * to "probably USD" would show a Kenyan shopper American prices for no better
 * reason than that the alternative was unlisted; leaving it null lets the
 * browser-locale guess have its turn, and then the base currency.
 */
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: 'NGN',
  GH: 'GHS',
  ZA: 'ZAR',
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'AUD',
  CN: 'CNY',
  HK: 'CNY',
  // The euro area, so an Irish or German shopper is not shown naira.
  IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR',
  SI: 'EUR', LU: 'EUR', LV: 'EUR', LT: 'EUR', EE: 'EUR', CY: 'EUR',
  MT: 'EUR', HR: 'EUR',
};

/**
 * Currency to suggest for an ISO country code, or null if there is no sensible
 * one. `offered` is the list the storefront actually shows, so a currency with
 * no FX rate loaded is never suggested.
 */
export function currencyForCountry(
  country: string | null | undefined,
  offered: string[]
): string | null {
  if (!country) return null;

  const code = country.trim().toUpperCase();
  /*
   * Cloudflare sends XX for anonymising proxies and T1 for Tor. Both mean "we
   * do not know", not "a country called XX".
   */
  if (code.length !== 2 || code === 'XX' || code === 'T1') return null;

  const currency = COUNTRY_CURRENCY[code];
  if (!currency) return null;

  return offered.includes(currency) ? currency : null;
}

/**
 * The visitor's country, as reported by the CDN in front of the app.
 *
 * `cf-ipcountry` is added by Cloudflare on every request, free, with no lookup
 * of our own and no visitor IP handed to a third party. Absent when the site is
 * not behind Cloudflare — in which case this returns null and the storefront
 * falls back to the browser-locale guess, exactly as before.
 *
 * Only trusted because it is set by the proxy the traffic actually passes
 * through. It is a plain header, so it is trivially forgeable by anyone hitting
 * the origin directly — which is harmless here, since the worst a forged value
 * can do is show someone prices in a currency they did not want, and the
 * switcher is one click away.
 */
export function countryFromHeaders(headers: Headers): string | null {
  return headers.get('cf-ipcountry');
}
