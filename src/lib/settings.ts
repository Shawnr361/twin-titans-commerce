import { prisma } from './db';
import { DEFAULT_RULES, PAYSTACK_NG_FEES, type PricingRules } from './pricing';

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
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Twin Titans Emporium',
  tagline: 'Premium finds, delivered to your door.',
  baseCurrency: 'NGN',
  supportEmail: '',
  supportPhone: '',
  shippingFlatMinor: 0,
  freeShippingOverMinor: 0,
  displayCurrencies: ['NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD'],
  paypalCurrency: 'USD',
  announcement: 'Free delivery nationwide • Pay on delivery available',
};

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
  return readSetting('pricing', { ...DEFAULT_RULES, fees: PAYSTACK_NG_FEES });
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}
