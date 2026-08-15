import { prisma } from './db';
import { convertMinor } from './money';

/**
 * FX has two distinct jobs here and conflating them causes real money bugs:
 *
 *  1. SOURCING — converting a supplier's USD/CNY cost into base currency so
 *     margin maths is correct. Must be conservative (buy-side rate).
 *  2. DISPLAY — showing a Nigerian-priced product to a diaspora buyer in GBP.
 *     Cosmetic only; the actual charge stays in the gateway's currency.
 *
 * Rates are stored as "target units per 1 BASE unit".
 */

export const FALLBACK_RATES: Record<string, number> = {
  NGN: 1,
  USD: 1 / 1500,
  GBP: 1 / 1900,
  EUR: 1 / 1650,
  CAD: 1 / 1100,
  AUD: 1 / 1000,
  CNY: 1 / 210,
};

export async function getRates(): Promise<Record<string, number>> {
  try {
    const rows = await prisma.fxRate.findMany();
    if (!rows.length) return { ...FALLBACK_RATES };
    const map: Record<string, number> = { ...FALLBACK_RATES };
    for (const r of rows) map[r.code.toUpperCase()] = r.rate;
    return map;
  } catch {
    return { ...FALLBACK_RATES };
  }
}

export async function getRate(code: string): Promise<number> {
  const rates = await getRates();
  return rates[code.toUpperCase()] ?? 1;
}

/**
 * Convert a supplier cost into base currency.
 *
 * `sourceRate` is target-per-base, so going the other way (source -> base) uses
 * its reciprocal. A `buyBufferPct` is applied because the rate you actually pay
 * to buy foreign currency is always worse than the mid-market rate you look up —
 * skipping this is how a 20% margin quietly becomes 12%.
 */
export async function sourceCostToBase(
  costMinor: number,
  sourceCurrency: string,
  baseCurrency: string,
  buyBufferPct = 3
): Promise<{ baseMinor: number; rateUsed: number }> {
  const src = sourceCurrency.toUpperCase();
  const base = baseCurrency.toUpperCase();
  if (src === base) return { baseMinor: costMinor, rateUsed: 1 };

  const rates = await getRates();
  const targetPerBase = rates[src];
  if (!targetPerBase || targetPerBase <= 0) {
    return { baseMinor: costMinor, rateUsed: 1 };
  }

  const basePerTarget = (1 / targetPerBase) * (1 + buyBufferPct / 100);
  return {
    baseMinor: convertMinor(costMinor, src, base, basePerTarget),
    rateUsed: basePerTarget,
  };
}

export async function upsertRate(code: string, rate: number, symbol = ''): Promise<void> {
  await prisma.fxRate.upsert({
    where: { code: code.toUpperCase() },
    create: { code: code.toUpperCase(), rate, symbol },
    update: { rate, symbol },
  });
}
