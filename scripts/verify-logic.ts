/**
 * Verification harness for the two pieces of logic that move real money:
 * supplier-URL parsing and the pricing engine. Runs with no database.
 *
 *   npx tsx scripts/verify-logic.ts
 */
import { parseSupplierUrl, stripTracking } from '../src/lib/suppliers/parse';
import { auditMargin, computePrice, gatewayFee, PAYSTACK_NG_FEES } from '../src/lib/pricing';
import { DEFAULT_RULES } from '../src/lib/pricing';
import { formatMoney, toMinor } from '../src/lib/money';
import { getRate, sourceCostToBase } from '../src/lib/fx';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
}

function assert(name: string, condition: boolean, detail = '') {
  if (!condition) failures++;
  console.log(`${condition ? '  ✓' : '  ✗'} ${name}${condition ? '' : ` — ${detail}`}`);
}

console.log('\n── Supplier URL parsing ──────────────────────────────');

const urls: [string, string, string][] = [
  // [input, expected platform, expected id]
  [
    'https://www.aliexpress.com/item/1005007635123586.html?spm=a2g0o.productlist.main.1&pdp_npi=4%40dis',
    'ALIEXPRESS',
    '1005007635123586',
  ],
  ['https://www.aliexpress.us/item/1005007096939770.html', 'ALIEXPRESS', '1005007096939770'],
  ['https://m.aliexpress.com/i/1005007939683801.html', 'ALIEXPRESS', '1005007939683801'],
  [
    'https://www.alibaba.com/product-detail/Wholesale-Galaxy-Star-Projector_1600123456789.html',
    'ALIBABA',
    '1600123456789',
  ],
  ['https://detail.1688.com/offer/612345678901.html', 'C1688', '612345678901'],
  ['https://m.1688.com/offer/745123456.html?spm=a260k', 'C1688', '745123456'],
];

for (const [input, platform, id] of urls) {
  const parsed = parseSupplierUrl(input);
  check(`${platform} ${id}`, [parsed?.platform, parsed?.externalId], [platform, id]);
}

const short = parseSupplierUrl('https://a.aliexpress.com/_mNxQvBc');
assert('short share links are flagged for resolution', short?.needsResolution === true);

const stripped = stripTracking(
  'https://www.aliexpress.com/item/1005007635123586.html?spm=abc&aff_trace_key=xyz&utm_source=fb&sku=1'
);
assert(
  'tracking params are stripped',
  !stripped.includes('spm') && !stripped.includes('aff_trace_key') && !stripped.includes('utm_source'),
  stripped
);

console.log('\n── Gateway fees (Paystack NG) ────────────────────────');

check('fee waived under ₦2,500', gatewayFee(toMinor(2000, 'NGN'), PAYSTACK_NG_FEES), toMinor(30, 'NGN'));
check(
  'fee = 1.5% + ₦100 at ₦10,000',
  gatewayFee(toMinor(10000, 'NGN'), PAYSTACK_NG_FEES),
  toMinor(250, 'NGN')
);
assert(
  'fee capped at ₦2,000 on large orders',
  gatewayFee(toMinor(1000000, 'NGN'), PAYSTACK_NG_FEES) === toMinor(2000, 'NGN'),
  String(gatewayFee(toMinor(1000000, 'NGN'), PAYSTACK_NG_FEES))
);

console.log('\n── Pricing engine ────────────────────────────────────');

// The real case from the old store: a supplier whose landed cost was ₦32.12k
// while the carried-over price was ₦43,199 — which was actually BELOW cost once
// fees were counted. The engine must never produce that.
const badCost = toMinor(44300, 'NGN');
const priced = computePrice(badCost, DEFAULT_RULES);
assert(
  'price always clears landed cost + fee',
  priced.profitMinor > 0,
  `profit ${formatMoney(priced.profitMinor)}`
);
assert(
  'price respects the target margin',
  priced.marginPct >= DEFAULT_RULES.marginPct - 5,
  `${priced.marginPct.toFixed(1)}%`
);
assert(
  'charm rounding lands on a x,999 boundary',
  priced.priceMinor % toMinor(1000, 'NGN') === toMinor(999, 'NGN'),
  formatMoney(priced.priceMinor)
);
console.log(
  `      cost ${formatMoney(badCost)} → price ${formatMoney(priced.priceMinor)} ` +
    `(profit ${formatMoney(priced.profitMinor)}, ${priced.marginPct.toFixed(1)}%)`
);

// A cheap item where the flat fee dominates.
const cheap = computePrice(toMinor(1200, 'NGN'), DEFAULT_RULES);
assert('cheap items stay profitable too', cheap.profitMinor > 0, formatMoney(cheap.profitMinor));

// Fixed-profit strategy: Kenny's "$30 per unit" instruction from the Nivea call.
const fixed = computePrice(toMinor(31833, 'NGN'), {
  ...DEFAULT_RULES,
  strategy: 'FIXED_PROFIT',
  profitMinor: toMinor(40000, 'NGN'),
});
assert(
  'fixed-profit strategy hits its target within rounding',
  fixed.profitMinor >= toMinor(40000, 'NGN'),
  formatMoney(fixed.profitMinor)
);
console.log(
  `      cost ${formatMoney(toMinor(31833, 'NGN'))} + ₦40,000 target → ` +
    `price ${formatMoney(fixed.priceMinor)} (actual profit ${formatMoney(fixed.profitMinor)})`
);

// The minimum-margin floor must override a too-low target.
const floored = computePrice(toMinor(10000, 'NGN'), {
  ...DEFAULT_RULES,
  strategy: 'MULTIPLIER',
  multiplier: 1.02, // deliberately far too thin
  minMarginPct: 25,
});
assert(
  'minimum-margin floor overrides a thin strategy',
  floored.marginPct >= 24,
  `${floored.marginPct.toFixed(1)}%`
);
assert('floor raise is reported as a warning', floored.warnings.length > 0);

console.log('\n── Margin audit ──────────────────────────────────────');

const loss = auditMargin(toMinor(43199, 'NGN'), toMinor(44300, 'NGN'), DEFAULT_RULES);
check('below-cost variant flagged as a loss', loss.severity, 'loss');
assert('loss variant is not ok', loss.ok === false);

const thin = auditMargin(toMinor(12000, 'NGN'), toMinor(10500, 'NGN'), DEFAULT_RULES);
check('thin variant flagged', thin.severity, 'thin');

const healthy = auditMargin(toMinor(32999, 'NGN'), toMinor(14100, 'NGN'), DEFAULT_RULES);
check('healthy variant passes', healthy.severity, 'ok');

const noCost = auditMargin(toMinor(9999, 'NGN'), 0, DEFAULT_RULES);
assert('missing cost is never treated as healthy', noCost.ok === false);

// Top-level await is unavailable under the CJS transform, so the async FX
// checks and the final summary run inside one IIFE.
void (async () => {
  console.log('');
  console.log('── FX safety ───────────────────────────────────');

  const sameCcy = await sourceCostToBase(toMinor(5000, 'NGN'), 'NGN', 'NGN');
  check(
    'same currency passes through at rate 1',
    [sameCcy.baseMinor, sameCcy.converted],
    [toMinor(5000, 'NGN'), true]
  );

  const usdCost = toMinor(12, 'USD');
  const usdConv = await sourceCostToBase(usdCost, 'USD', 'NGN');
  assert(
    'known currency converts at a buy-side rate',
    usdConv.converted && usdConv.rateUsed > 1400 && usdConv.rateUsed < 1700,
    `rate ${usdConv.rateUsed.toFixed(2)} (mid 1500 + 3% buffer)`
  );
  assert(
    'a USD cost lands materially higher in NGN',
    usdConv.baseMinor > usdCost * 100,
    formatMoney(usdConv.baseMinor, 'NGN')
  );

  /*
   * The regression that matters: an unseeded currency used to return the cost
   * unchanged at rate 1, so a supplier cost was read as though it were already
   * naira and every variant priced below what it cost to buy.
   */
  const unseeded = await sourceCostToBase(usdCost, 'BRL', 'NGN');
  assert('unseeded currency is refused, not passed through', unseeded.converted === false);
  assert('refused conversion never echoes the source cost', unseeded.baseMinor !== usdCost);
  check('refused conversion reports zero cost', unseeded.baseMinor, 0);
  check('refused conversion reports no rate', unseeded.rateUsed, 0);

  const unpriceable = computePrice(unseeded.baseMinor, DEFAULT_RULES);
  assert(
    'a refused cost cannot be verified as profitable',
    unpriceable.warnings.length > 0,
    unpriceable.warnings[0]
  );

  // 'XXX' is what the browser capture emits when it cannot identify the symbol.
  const xxx = await sourceCostToBase(toMinor(9999, 'NGN'), 'XXX', 'NGN');
  assert('the XXX unknown-currency marker is refused', xxx.converted === false);

  check('getRate returns null for an unknown code', await getRate('ZZZ'), null);
  assert('getRate still resolves a seeded code', (await getRate('USD')) !== null);

  console.log(
    `\n${failures === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failures} CHECK(S) FAILED`}\n`
  );
  process.exit(failures === 0 ? 0 : 1);
})();
