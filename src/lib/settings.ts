import { prisma } from './db';
import { DEFAULT_RULES, FLUTTERWAVE_NG_FEES, type PricingRules } from './pricing';

export interface StoreSettings {
  storeName: string;
  tagline: string;
  baseCurrency: string;
  supportEmail: string;
  supportPhone: string;
  /** Flat shipping charged to the customer, base minor units. 0 = free. */
  shippingFlatMinor: number;
  freeShippingOverMinor: number;
  /** Currencies offered in the storefront switcher. */
  displayCurrencies: string[];
  /** PayPal can never charge NGN — it always settles in this currency. */
  paypalCurrency: string;
  announcement: string;
  /**
   * How the announcement is shown. 'marquee' scrolls one continuous line;
   * 'rotate' shows one message at a time, sliding down from the top.
   */
  announcementStyle: AnnouncementStyle;
}

export type AnnouncementStyle = 'marquee' | 'rotate';

export const ANNOUNCEMENT_STYLES: AnnouncementStyle[] = ['marquee', 'rotate'];

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Twin Titans Emporium',
  tagline: 'Premium finds, delivered to your door.',
  baseCurrency: 'NGN',
  supportEmail: '',
  supportPhone: '',
  /*
   * Delivery. The threshold is the merchant's instruction: free only above
   * ₦30,000. The flat rate below it is an ASSUMPTION — ₦3,500 — because a
   * threshold with a zero flat rate means nothing: everything ships free and
   * the rule is decoration. Both are editable in admin Settings; change the
   * flat rate there if ₦3,500 is wrong.
   */
  shippingFlatMinor: 350_000, // ₦3,500 in kobo
  freeShippingOverMinor: 3_000_000, // ₦30,000 in kobo
  displayCurrencies: ['NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD'],
  paypalCurrency: 'USD',
  /*
   * Must not promise unconditional free delivery while a threshold exists —
   * that is a false claim in the most prominent line on the site. The settings
   * route rejects the combination outright.
   */
  announcement: 'Free delivery on orders over ₦30,000 • Tracked on every order',
  announcementStyle: 'marquee',
};

/**
 * The banner is one message per line.
 *
 * A newline is the only separator a merchant can type without being taught a
 * syntax, and it survives the bullet characters already used *inside* a single
 * message ("Free delivery • Tracked on every order") — splitting on those
 * would have chopped the existing banner in half on upgrade.
 */
export function announcementMessages(announcement: string): string[] {
  return announcement
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (!row) return fallback;
    return { ...fallback, ...(row.value as object) } as T;
  } catch {
    // Settings must never take the storefront down — fall back to defaults.
    return fallback;
  }
}

export function getStoreSettings(): Promise<StoreSettings> {
  return readSetting('store', DEFAULT_SETTINGS);
}

export function getPricingRules(): Promise<PricingRules> {
  return readSetting('pricing', { ...DEFAULT_RULES, fees: FLUTTERWAVE_NG_FEES });
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

/**
 * Does the announcement promise free delivery the shipping rule does not honour?
 *
 * The announcement is the most prominent line on the site, so "free delivery
 * nationwide" while a threshold exists is a false promise to every customer
 * below it — the same class of problem as the "pay on delivery" line that had
 * to be removed. Any qualifier ("over", "above", "when you spend") makes the
 * claim conditional and therefore honest.
 */
export function announcementContradictsShipping(
  announcement: string,
  freeShippingOverMinor: number
): boolean {
  if (freeShippingOverMinor <= 0) return false;
  /*
   * Checked per message, not across the whole box. Once the banner can hold
   * several lines, reading them as one string lets a qualifier in a later line
   * excuse a bare promise in an earlier one — "Free delivery nationwide" and
   * "Over 70 products in stock" would pass together while the first line is
   * still a lie on its own.
   */
  return announcementMessages(announcement).some((message) => {
    const claim = message.toLowerCase();
    const promisesFree = /(free|complimentary)\s+(delivery|shipping)/.test(claim);
    const qualified = /(over|above|from|orders? of|when you spend)/.test(claim);
    return promisesFree && !qualified;
  });
}
