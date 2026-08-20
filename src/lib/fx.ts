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

/**
 * Look up a display rate, or null when the code is unknown.
 *
 * Returning 1 for an unknown currency silently asserts parity between two
 * currencies, which is never true and is not a safe default: at 1.0 a ₦50,000
 * order converts to $50,000. Callers must decide what to do instead.
 */
export async function getRate(code: string): Promise<number | null> {
  const rates = await getRates();
  return rates[code.toUpperCase()] ?? null;
}

/**
 * Convert a supplier cost into base currency.
 *
 * `sourceRate` is target-per-base, so going the other way (source -> base) uses
 * its reciprocal. A `buyBufferPct` is applied because the rate you actually pay
 * to buy foreign currency is always worse than the mid-market rate you look up —
 * skipping this is how a 20% margin quietly becomes 12%.
 */
export interface SourceCostConversion {
  /** Landed cost in base currency. Zero when the rate was unavailable. */
  baseMinor: number;
  rateUsed: number;
  /**
   * False when no usable rate existed for `sourceCurrency`. The cost is then
   * reported as zero rather than guessed, so downstream guardrails fire.
   */
  converted: boolean;
}

export async function sourceCostToBase(
  costMinor: number,
  sourceCurrency: string,
  baseCurrency: string,
  buyBufferPct = 3
): Promise<SourceCostConversion> {
  const src = sourceCurrency.toUpperCase();
  const base = baseCurrency.toUpperCase();
  if (src === base) return { baseMinor: costMinor, rateUsed: 1, converted: true };

  const rates = await getRates();
  const targetPerBase = rates[src];
  if (!targetPerBase || targetPerBase <= 0) {
    /*
     * No rate for this currency. Passing the cost through unchanged — which is
     * what this used to do — asserts that 1 unit of the supplier's currency
     * equals 1 unit of ours, so a $12 cost becomes ₦12 and every variant is
     * priced far below what it costs to buy. The browser capture can now report
     * BRL, INR, TRY, PHP and others that have no seeded rate, so this path is
     * reachable in normal use.
     *
     * Report zero instead. computePrice already treats a zero landed cost as
     * "cannot verify profitability", and commit refuses to publish without a
     * hand-entered cost, so the existing guardrails do the work.
     */
    return { baseMinor: 0, rateUsed: 0, converted: false };
  }

  const basePerTarget = (1 / targetPerBase) * (1 + buyBufferPct / 100);
  return {
    baseMinor: convertMinor(costMinor, src, base, basePerTarget),
    rateUsed: basePerTarget,
    converted: true,
  };
}

export async function upsertRate(code: string, rate: number, symbol = ''): Promise<void> {
  await prisma.fxRate.upsert({
    where: { code: code.toUpperCase() },
    create: { code: code.toUpperCase(), rate, symbol },
    update: { rate, symbol },
  });
}
