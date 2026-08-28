/**
 * Pricing engine.
 *
 * This exists because the Shopify store repeatedly shipped variants priced at
 * or BELOW their landed cost — a live per-unit loss, found three separate times,
 * always because one flat price was applied across variants whose supplier cost
 * differed per SKU. Here, price is *derived* from each variant's own cost and
 * the derivation refuses to produce a losing price.
 *
 * The gateway fee is part of the solve, not an afterthought: fee depends on
 * price, so "cost + 40% margin" silently under-earns unless you solve for it.
 */

import { toMinor } from './money';

export type PricingStrategy = 'MARGIN' | 'FIXED_PROFIT' | 'MULTIPLIER';

export interface GatewayFeeModel {
  /** Fractional, e.g. 0.015 for 1.5%. */
  percent: number;
  /** Flat component in base minor units. */
  flatMinor: number;
  /** Flat component is waived below this order value (Paystack does this). */
  flatWaivedBelowMinor: number;
  /** Hard cap on the total fee, 0 = uncapped. */
  capMinor: number;
}

/**
 * Flutterwave Nigeria, local transactions — CHECK THIS against their current
 * pricing page before trusting it; gateway pricing changes and a stale model
 * quietly eats margin on every product priced after it drifts.
 *
 * Unlike Paystack there is no flat component, so the waiver threshold is nil.
 */
export const FLUTTERWAVE_NG_FEES: GatewayFeeModel = {
  percent: 0.014,
  flatMinor: 0,
  flatWaivedBelowMinor: 0,
  capMinor: toMinor(2000, 'NGN'),
};

/**
 * Retained for reference and for re-pricing history: products priced before
 * the switch were costed against this model, so it explains their margins.
 */
export const PAYSTACK_NG_FEES: GatewayFeeModel = {
  percent: 0.015,
  flatMinor: toMinor(100, 'NGN'),
  flatWaivedBelowMinor: toMinor(2500, 'NGN'),
  capMinor: toMinor(2000, 'NGN'),
};

export const NO_FEES: GatewayFeeModel = {
  percent: 0,
  flatMinor: 0,
  flatWaivedBelowMinor: 0,
  capMinor: 0,
};

export interface PricingRules {
  strategy: PricingStrategy;
  /** MARGIN: target margin on the SELLING price, in percent points. */
  marginPct: number;
  /** FIXED_PROFIT: desired net profit per unit, base minor units. */
  profitMinor: number;
  /** MULTIPLIER: price = cost * multiplier (fees eat into margin). */
  multiplier: number;

  /** Never publish anything under this net margin, whatever the strategy says. */
  minMarginPct: number;

  /** Extra per-unit overhead to bake in (ad spend allowance, packaging, etc.). */
  overheadMinor: number;
  /** Or as a percentage of cost. Both are applied if both are set. */
  overheadPct: number;

  fees: GatewayFeeModel;

  /**
   * Charm rounding. NGN stores round to x,999; USD to x.99. Rounding is always
   * UP so it can never erode the solved margin.
   */
  roundToMinor: number;
  roundEndingMinor: number;

  /** Auto compare-at price, as a multiple of the final price. 0 disables. */
  compareAtMultiplier: number;
}

export const DEFAULT_RULES: PricingRules = {
  strategy: 'MARGIN',
  // Merchant's decision, 2026-08-25: 35% rather than 45%. Applies to everything
  // imported from here on; existing products were re-priced to match via
  // POST /api/admin/reprice.
  marginPct: 35,
  profitMinor: 0,
  multiplier: 2.5,
  minMarginPct: 20,
  overheadMinor: 0,
  overheadPct: 0,
  fees: FLUTTERWAVE_NG_FEES,
  roundToMinor: toMinor(1000, 'NGN'),
  roundEndingMinor: toMinor(999, 'NGN'),
  compareAtMultiplier: 1.45,
};

export function gatewayFee(priceMinor: number, fees: GatewayFeeModel): number {
  if (priceMinor <= 0) return 0;
  const flat = priceMinor < fees.flatWaivedBelowMinor ? 0 : fees.flatMinor;
  const raw = Math.round(priceMinor * fees.percent) + flat;
  return fees.capMinor > 0 ? Math.min(raw, fees.capMinor) : raw;
}

/** Round UP to the next `...roundEnding` boundary, e.g. 31_240 -> 32_999. */
function charmRound(priceMinor: number, roundToMinor: number, endingMinor: number): number {
  if (roundToMinor <= 0) return priceMinor;
  const steps = Math.ceil((priceMinor - endingMinor) / roundToMinor);
  const candidate = Math.max(0, steps) * roundToMinor + endingMinor;
  return candidate < priceMinor ? candidate + roundToMinor : candidate;
}

/**
 * Solve for the price that nets `targetProfitMinor` after cost and gateway fee.
 *
 * fee is piecewise (waiver threshold, cap) so this closes the loop numerically
 * rather than trusting a single algebraic pass.
 */
function solveForProfit(
  costMinor: number,
  targetProfitMinor: number,
  fees: GatewayFeeModel
): number {
  let price = costMinor + targetProfitMinor;
  for (let i = 0; i < 12; i++) {
    const fee = gatewayFee(price, fees);
    const next = costMinor + targetProfitMinor + fee;
    if (Math.abs(next - price) <= 1) return next;
    price = next;
  }
  return price;
}

/** Solve for the price whose NET margin (after fee) equals `marginPct`. */
function solveForMargin(costMinor: number, marginPct: number, fees: GatewayFeeModel): number {
  const m = Math.min(Math.max(marginPct, 0), 95) / 100;
  // price - fee(price) - cost = m * price  =>  iterate, since fee is piecewise.
  let price = m >= 1 ? costMinor * 20 : Math.round(costMinor / (1 - m));
  for (let i = 0; i < 24; i++) {
    const fee = gatewayFee(price, fees);
    const next = m >= 1 ? price : Math.round((costMinor + fee) / (1 - m));
    if (Math.abs(next - price) <= 1) return next;
    price = next;
  }
  return price;
}

export interface PriceResult {
  priceMinor: number;
  compareAtMinor: number | null;
  costMinor: number;
  feeMinor: number;
  profitMinor: number;
  marginPct: number;
  warnings: string[];
}

export function computePrice(rawCostMinor: number, rules: PricingRules = DEFAULT_RULES): PriceResult {
  const warnings: string[] = [];
  const overhead = rules.overheadMinor + Math.round(rawCostMinor * (rules.overheadPct / 100));
  const costMinor = rawCostMinor + overhead;

  if (rawCostMinor <= 0) {
    warnings.push('No landed cost recorded — price cannot be verified as profitable.');
  }

  let price: number;
  switch (rules.strategy) {
    case 'FIXED_PROFIT':
      price = solveForProfit(costMinor, rules.profitMinor, rules.fees);
      break;
    case 'MULTIPLIER':
      price = Math.round(costMinor * Math.max(rules.multiplier, 1));
      break;
    case 'MARGIN':
    default:
      price = solveForMargin(costMinor, rules.marginPct, rules.fees);
      break;
  }

  price = charmRound(price, rules.roundToMinor, rules.roundEndingMinor);

  // Guardrail: whatever the strategy produced, refuse to go under the floor.
  const floor = charmRound(
    solveForMargin(costMinor, rules.minMarginPct, rules.fees),
    rules.roundToMinor,
    rules.roundEndingMinor
  );
  if (price < floor) {
    warnings.push(
      `Strategy produced a price below the ${rules.minMarginPct}% minimum margin; raised to the floor.`
    );
    price = floor;
  }

  const feeMinor = gatewayFee(price, rules.fees);
  const profitMinor = price - feeMinor - costMinor;
  const marginPct = price > 0 ? (profitMinor / price) * 100 : 0;

  if (profitMinor <= 0) {
    warnings.push('This variant would sell at a LOSS. Do not publish it.');
  }

  const compareAtMinor =
    rules.compareAtMultiplier > 1
      ? charmRound(
          Math.round(price * rules.compareAtMultiplier),
          rules.roundToMinor,
          rules.roundEndingMinor
        )
      : null;

  return { priceMinor: price, compareAtMinor, costMinor, feeMinor, profitMinor, marginPct, warnings };
}

export interface MarginAudit {
  ok: boolean;
  severity: 'ok' | 'thin' | 'loss';
  priceMinor: number;
  costMinor: number;
  feeMinor: number;
  profitMinor: number;
  marginPct: number;
  message: string;
}

/**
 * Audit an already-priced variant. Run this over EVERY variant — not one
 * representative per product. Per-SKU cost variance is exactly what a
 * spot-check misses.
 */
export function auditMargin(
  priceMinor: number,
  costMinor: number,
  rules: PricingRules = DEFAULT_RULES
): MarginAudit {
  const feeMinor = gatewayFee(priceMinor, rules.fees);
  const profitMinor = priceMinor - feeMinor - costMinor;
  const marginPct = priceMinor > 0 ? (profitMinor / priceMinor) * 100 : 0;

  if (costMinor <= 0) {
    return {
      ok: false,
      severity: 'thin',
      priceMinor,
      costMinor,
      feeMinor,
      profitMinor,
      marginPct,
      message: 'No landed cost on file — margin unverifiable.',
    };
  }
  if (profitMinor <= 0) {
    return {
      ok: false,
      severity: 'loss',
      priceMinor,
      costMinor,
      feeMinor,
      profitMinor,
      marginPct,
      message: 'Selling at or below landed cost — every sale loses money.',
    };
  }
  if (marginPct < rules.minMarginPct) {
    return {
      ok: false,
      severity: 'thin',
      priceMinor,
      costMinor,
      feeMinor,
      profitMinor,
      marginPct,
      message: `Margin ${marginPct.toFixed(1)}% is under the ${rules.minMarginPct}% floor.`,
    };
  }
  return {
    ok: true,
    severity: 'ok',
    priceMinor,
    costMinor,
    feeMinor,
    profitMinor,
    marginPct,
    message: `Healthy: ${marginPct.toFixed(1)}% net margin.`,
  };
}
