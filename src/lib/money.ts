/**
 * Money helpers.
 *
 * Everything monetary in this codebase is an integer in MINOR units (kobo,
 * cents). Floats are only ever allowed for FX rates and percentages, and only
 * inside these functions — a float must never be stored in, or read out of, a
 * money column.
 */

export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'XAF', 'XOF']);

export function minorUnitFactor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/** "39.99" | 39.99 -> 3999 */
export function toMinor(amount: number | string, currency = 'NGN'): number {
  const n = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * minorUnitFactor(currency));
}

/** 3999 -> 39.99 */
export function fromMinor(minor: number, currency = 'NGN'): number {
  return minor / minorUnitFactor(currency);
}

const SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
  ZAR: 'R',
  GHS: 'GH₵',
  KES: 'KSh',
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase() + ' ';
}

export function formatMoney(minor: number, currency = 'NGN'): string {
  const value = fromMinor(minor, currency);
  const cur = currency.toUpperCase();
  // Naira reads better without trailing kobo — nobody prices in kobo.
  const decimals = cur === 'NGN' ? (Number.isInteger(value) ? 0 : 2) : 2;
  return (
    currencySymbol(cur) +
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/**
 * Convert between currencies using a rate expressed as "target units per 1 base
 * unit". Rounds once, at the end, in the target currency's minor units.
 */
export function convertMinor(
  minor: number,
  fromCurrency: string,
  toCurrency: string,
  ratePerBase: number
): number {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return minor;
  const major = fromMinor(minor, fromCurrency) * ratePerBase;
  return Math.round(major * minorUnitFactor(toCurrency));
}

/**
 * Round a converted figure UP to a number that looks like a decision.
 *
 * A threshold set in one currency lands on noise in every other: ₦30,000 is
 * "$22.41", which reads like a glitch on a shop front rather than an offer.
 * This turns it into "$25".
 *
 * ALWAYS UP, NEVER DOWN — and that direction is the whole safety argument.
 * The real rule stays the base-currency one (₦30,000), so a rounded-up figure
 * is a promise we always beat: a shopper told "free over $25" who spends $23
 * gets free delivery anyway. Rounding down would do the opposite and advertise
 * delivery we do not actually give, which is the same false-promise class the
 * announcement validator already refuses to save.
 */
export function friendlyCeiling(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = amount < 10 ? 1 : amount < 100 ? 5 : amount < 1000 ? 10 : 100;
  return Math.ceil(amount / step) * step;
}
