import { countryByName } from './countries';

/**
 * What delivery costs, by destination.
 *
 * One function, used by the cart, by checkout (authoritative, on the server),
 * by the checkout summary in the browser, and mirrored in the Merchant Center
 * shipping policies. Delivery was a single flat rule; once overseas orders had
 * their own rate, every place that repeated the old rule would have quoted one
 * price and charged another — and Google compares what it is told against
 * what checkout actually charges.
 *
 * Pure, with no settings import, so the browser can use it too.
 */

export interface ShippingRuleSource {
  shippingFlatMinor: number;
  freeShippingOverMinor: number;
  intlShippingFlatMinor: number;
  intlFreeShippingOverMinor: number;
}

export interface ShippingRate {
  flatMinor: number;
  /** 0 = no free-delivery threshold. */
  freeOverMinor: number;
}

/**
 * Nigeria, or not yet chosen. An unknown destination is priced as domestic
 * only until the shopper picks one — the server re-prices at payment with the
 * country that was actually submitted.
 */
export function isDomestic(country: string | null | undefined): boolean {
  if (!country || !country.trim()) return true;
  return countryByName(country)?.iso === 'NG';
}

export function rateFor(settings: ShippingRuleSource, country?: string | null): ShippingRate {
  return isDomestic(country)
    ? { flatMinor: settings.shippingFlatMinor, freeOverMinor: settings.freeShippingOverMinor }
    : { flatMinor: settings.intlShippingFlatMinor, freeOverMinor: settings.intlFreeShippingOverMinor };
}

export function shippingFor(
  settings: ShippingRuleSource,
  subtotalMinor: number,
  country?: string | null
): number {
  const rate = rateFor(settings, country);
  return rate.freeOverMinor > 0 && subtotalMinor >= rate.freeOverMinor ? 0 : rate.flatMinor;
}
