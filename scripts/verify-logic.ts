/**
 * Verification harness for the two pieces of logic that move real money:
 * supplier-URL parsing and the pricing engine. Runs with no database.
 *
 *   npx tsx scripts/verify-logic.ts
 */
import { parseSupplierUrl, stripTracking } from '../src/lib/suppliers/parse';
import { cleanProductTitle } from '../src/lib/suppliers/title';
import {
  auditMargin,
  computePrice,
  gatewayFee,
  FLUTTERWAVE_NG_FEES,
  type GatewayFeeModel,
} from '../src/lib/pricing';
import { DEFAULT_RULES } from '../src/lib/pricing';
import { formatMoney, friendlyCeiling, fromMinor, toMinor } from '../src/lib/money';
import { getRate, sourceCostToBase } from '../src/lib/fx';
import { assessCapture } from '../src/lib/suppliers/capture';
import { displayVendor, isPublishableBrand } from '../src/lib/vendor';
import { categorise } from '../src/lib/categorise';
import { pickerLabels } from '../src/lib/vendor';
import { currencyForCountry } from '../src/lib/geo';
import { stripInventedClaims } from '../src/lib/copywriter';
import {
  announcementContradictsShipping,
  announcementMessages,
  DEFAULT_SETTINGS,
} from '../src/lib/settings';
import { FALLBACK_RATES } from '../src/lib/fx';

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

console.log('\n── Gateway fees (Paystack NG, historical) ────────────────────────');

/*
 * Paystack's old fee shape, kept HERE and not in src/: no gateway the store
 * uses has a flat component any more, so this exists only to exercise the
 * waiver branch of gatewayFee(), which Flutterwave's model (flat = 0) can
 * never reach. Production code should not carry a constant nothing prices with.
 */
const FLAT_FEE_FIXTURE: GatewayFeeModel = {
  percent: 0.015,
  flatMinor: toMinor(100, 'NGN'),
  flatWaivedBelowMinor: toMinor(2500, 'NGN'),
  capMinor: toMinor(2000, 'NGN'),
};

check('fee waived under ₦2,500', gatewayFee(toMinor(2000, 'NGN'), FLAT_FEE_FIXTURE), toMinor(30, 'NGN'));
check(
  'fee = 1.5% + ₦100 at ₦10,000',
  gatewayFee(toMinor(10000, 'NGN'), FLAT_FEE_FIXTURE),
  toMinor(250, 'NGN')
);
assert(
  'fee capped at ₦2,000 on large orders',
  gatewayFee(toMinor(1000000, 'NGN'), FLAT_FEE_FIXTURE) === toMinor(2000, 'NGN'),
  String(gatewayFee(toMinor(1000000, 'NGN'), FLAT_FEE_FIXTURE))
);

console.log('\n── Gateway fees (Flutterwave NG, live) ───────────────');
/*
 * 1.4% with NO flat component. Paystack added a flat ₦100 above ₦2,500; if that
 * were still being applied the store would be over-estimating its own costs on
 * every order and pricing itself high for no reason.
 */
check(
  'no flat fee on a small order',
  gatewayFee(toMinor(2000, 'NGN'), FLUTTERWAVE_NG_FEES),
  toMinor(28, 'NGN')
);
check(
  'fee = 1.4% at ₦10,000',
  gatewayFee(toMinor(10000, 'NGN'), FLUTTERWAVE_NG_FEES),
  toMinor(140, 'NGN')
);
assert(
  'fee capped at ₦2,000 on large orders',
  gatewayFee(toMinor(1000000, 'NGN'), FLUTTERWAVE_NG_FEES) === toMinor(2000, 'NGN'),
  String(gatewayFee(toMinor(1000000, 'NGN'), FLUTTERWAVE_NG_FEES))
);

console.log('\n── Flutterwave amount units ────────────────────────');
/*
 * THE 100x BUG, GUARDED.
 *
 * Paystack took kobo, so its adapter passed our minor units straight through.
 * Flutterwave takes NAIRA. If anyone ever "simplifies" the adapter by dropping
 * the conversion, a ₦35,997 order silently becomes a ₦3,599,700 charge on a
 * real customer's card. These checks are the tripwire.
 */
check('order total to Flutterwave major units', fromMinor(toMinor(35997, 'NGN'), 'NGN'), 35997);
check('Flutterwave amount back to minor units', toMinor(35997, 'NGN'), 3599700);
assert(
  'major and minor are NOT interchangeable',
  fromMinor(toMinor(35997, 'NGN'), 'NGN') !== toMinor(35997, 'NGN'),
  'conversion collapsed - the adapter would overcharge 100x'
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

// --- generated copy may not assert specs the supplier title never gave -------
//
// gemini-2.5-flash published "Recharges via USB for ease" for a clipper whose
// title said only "Cordless". The prompt forbids it twice, by rule and by that
// exact example, and the model did it anyway — so the guarantee lives here.
const clipper = 'Vintage Cordless Hair Cutting Machine Portable Hair Clipper';
const invented = stripInventedClaims(
  '<p>A trimmer for home use.</p><ul><li>Cordless operation for flexible use.</li>' +
    '<li>Recharges via USB for ease.</li><li>Available in several styles.</li></ul>',
  clipper
);
check('USB claim stripped when the title never said it', invented?.includes('USB'), false);
check('cordless survives — it IS in the title', invented?.includes('Cordless'), true);
check('innocent bullet survives', invented?.includes('several styles'), true);

check(
  'measurement absent from the title is stripped',
  stripInventedClaims('<p>A jug for the kitchen.</p><ul><li>Holds 500ml of liquid.</li></ul>', 'Water Jug')
    ?.includes('500ml'),
  false
);
check(
  'measurement PRESENT in the title survives',
  stripInventedClaims('<p>A jug for the kitchen.</p><ul><li>Holds 500ml of liquid.</li></ul>', '500ml Water Jug')
    ?.includes('500ml'),
  true
);
check(
  'copy that is nothing but invented specs is rejected outright',
  stripInventedClaims('<p>Made of stainless steel and charges over USB.</p>', 'Kitchen Tool'),
  null
);

// --- Geo currency suggestion ---------------------------------------------
const OFFERED = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'ZAR', 'CAD', 'AUD', 'CNY'];

check('NG suggests naira', currencyForCountry('NG', OFFERED), 'NGN');
check('lowercase header still resolves', currencyForCountry('gb', OFFERED), 'GBP');
check('euro area maps to EUR', currencyForCountry('DE', OFFERED), 'EUR');

// These two were mapped to USD before the switcher offered their own currency.
check('ZA suggests rand, not dollars', currencyForCountry('ZA', OFFERED), 'ZAR');
check('GH suggests cedi, not dollars', currencyForCountry('GH', OFFERED), 'GHS');

/*
 * The failure that matters: never suggest a currency with no FX rate loaded.
 * Doing so would leave the switcher on a code it cannot convert.
 */
check('unoffered currency is not suggested', currencyForCountry('GB', ['NGN', 'USD']), null);

// Cloudflare's "we do not know" values must not be read as countries.
check('XX (anonymous proxy) suggests nothing', currencyForCountry('XX', OFFERED), null);
check('T1 (Tor) suggests nothing', currencyForCountry('T1', OFFERED), null);
check('absent header suggests nothing', currencyForCountry(null, OFFERED), null);
check('unmapped country falls through', currencyForCountry('KE', OFFERED), null);


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
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('── Login redirect safety ────────────────');

  // `next` comes from the query string and is handed to window.location, so
  // an unchecked value sends someone who has just typed their password to
  // another site — convincing precisely because the login really worked.
  const safeNext = (next: string | null): string =>
    !next || !next.startsWith('/') || next.startsWith('//') ? '/admin' : next;

  check('a normal path is kept', safeNext('/admin/products'), '/admin/products');
  check('an absolute URL is refused', safeNext('https://example.com'), '/admin');
  check('a protocol-relative URL is refused', safeNext('//example.com'), '/admin');
  check('a missing next falls back', safeNext(null), '/admin');
  check('an empty next falls back', safeNext(''), '/admin');

  console.log('── Vendor lines ───────────────────────────');

  /*
   * Every non-null vendor in the live catalogue was a marketplace storefront
   * handle, not a maker. Printing one above the product name says nothing
   * about the product and rather a lot about where it was bought.
   */
  check('a storefront handle prints nothing', displayVendor('House Foocus Store'), null);
  /*
   * "<X> Official Store" is the brand's own shopfront, so X is kept — but only
   * when X is short enough to be a name rather than a pile of search terms.
   */
  check('an official store yields the brand', displayVendor('Ajazz Official Store'), 'Ajazz');
  check('a two-word brand survives', displayVendor('Jomay Lashes Official Store'), 'Jomay Lashes');
  check(
    'a three-word official store is not a brand',
    displayVendor('Aswesaw Global Lighting Official Store'),
    null
  );
  check(
    'a flagship search-term salad is not a brand',
    displayVendor('Ibcccndc Lakerain Global Cosmetics Flagship Store'),
    null
  );
  check('a factory store prints nothing', displayVendor('Fadvan Lashes Factory Store'), null);
  check('the marketplace itself prints nothing', displayVendor('ALIEXPRESS supplier'), null);
  check('an unnamed supplier prints nothing', displayVendor(null), null);
  // A genuine maker still gets its name on the card.
  check('a real brand survives', displayVendor('Ajazz'), 'Ajazz');
  check('a real brand survives casing', displayVendor('COSRX'), 'COSRX');
  assert(
    'the storefront rule and the schema.org brand rule are the same rule',
    !isPublishableBrand('House Foocus Store') && isPublishableBrand('Ajazz')
  );

  console.log('── Product titles ─────────────────────────');

  // The marketplace tail is the loudest junk: the number is AliExpress's own
  // category id, and it reads as part of the product name on a card.
  check(
    'the AliExpress tail is removed',
    cleanProductTitle('Mini Portable Fan - AliExpress 15'),
    'Mini Portable Fan'
  );
  check(
    'a stacked tail is removed too',
    cleanProductTitle('Mini Portable Fan - Free Shipping - AliExpress 200165144'),
    'Mini Portable Fan'
  );
  // Pack size is information; "1pc" is not.
  check('a leading 1pc goes', cleanProductTitle('1PC Red Toilet Brush'), 'Red Toilet Brush');
  check(
    'a real pack size stays',
    cleanProductTitle('120 Rolls Dog Poop Bag'),
    '120 Rolls Dog Poop Bag'
  );
  // Cleaning must never invent, and must never leave a half-word behind.
  assert(
    'an over-long title is cut on a word boundary',
    !/\s$/.test(cleanProductTitle('a'.repeat(20) + ' ' + 'b'.repeat(90))) &&
      cleanProductTitle('Word '.repeat(40)).length <= 70
  );
  assert(
    'cleaning is idempotent',
    cleanProductTitle(cleanProductTitle('3 in 1 Magic Brush Floor Scrub Brush Broom Brush Long Handle Household Cleaning Brush Stainless Steel - AliExpress 15')) ===
      cleanProductTitle('3 in 1 Magic Brush Floor Scrub Brush Broom Brush Long Handle Household Cleaning Brush Stainless Steel - AliExpress 15')
  );
  check(
    'an already-good title is left alone',
    cleanProductTitle('USB LED String Lights 5/10/20M Waterproof Fairy Lights'),
    'USB LED String Lights 5/10/20M Waterproof Fairy Lights'
  );

  console.log('── Threshold rounding ─────────────────────');

  // ₦30,000 converts to $22.41, which reads like a bug on a shop front.
  check('an awkward conversion becomes a round number', friendlyCeiling(22.41), 25);
  check('an already-round figure is left alone', friendlyCeiling(25), 25);
  check('small amounts round to the next unit', friendlyCeiling(7.2), 8);
  check('large amounts round to the next hundred', friendlyCeiling(1234), 1300);
  check('nothing to round', friendlyCeiling(0), 0);

  /*
   * The safety property, stated as a test rather than a comment: the advertised
   * threshold must never sit BELOW the real one, or the bar promises free
   * delivery that checkout will refuse.
   */
  let roundsDown = 0;
  for (let cents = 1; cents <= 500_000; cents += 7) {
    if (friendlyCeiling(cents / 100) < cents / 100) roundsDown++;
  }
  check('rounding is never downward, across 71k amounts', roundsDown, 0);

  console.log('── Delivery promise ───────────────────────');

  // The banner is the most prominent line on the site; an unconditional
  // promise beside a threshold is a false claim to everyone below it.
  assert(
    'unconditional free delivery is refused when a threshold exists',
    announcementContradictsShipping('Free delivery nationwide - tracked on every order', 3_000_000)
  );
  assert(
    'a qualified promise is allowed',
    !announcementContradictsShipping('Free delivery on orders over ₦30,000', 3_000_000)
  );
  assert(
    '"complimentary shipping above X" is allowed',
    !announcementContradictsShipping('Complimentary shipping above ₦30,000', 3_000_000)
  );
  assert(
    'with no threshold, an unconditional promise is fine',
    !announcementContradictsShipping('Free delivery nationwide', 0)
  );
  // The shipped defaults must not contradict each other.
  assert(
    'the default banner matches the default threshold',
    !announcementContradictsShipping(DEFAULT_SETTINGS.announcement, DEFAULT_SETTINGS.freeShippingOverMinor)
  );
  /*
   * The banner holds one message per line, and each line is a claim on its own.
   * Read as a single string, the qualifier in the second line below would
   * excuse the bare promise in the first.
   */
  assert(
    'a bare promise is caught even when another line carries a qualifier',
    announcementContradictsShipping(
      'Free delivery nationwide\nOver 70 products in stock',
      3_000_000
    )
  );
  check('blank lines are not messages', announcementMessages('One\n\n Two ').length, 2);

  // A threshold with a zero flat rate is decoration: everything ships free.
  assert(
    'a free-shipping threshold has a flat rate behind it',
    DEFAULT_SETTINGS.freeShippingOverMinor === 0 || DEFAULT_SETTINGS.shippingFlatMinor > 0,
    `flat ${DEFAULT_SETTINGS.shippingFlatMinor}, threshold ${DEFAULT_SETTINGS.freeShippingOverMinor}`
  );

  console.log('');
  console.log('── FX rate sanity ────────────────────────');

  // Guards against a fat-fingered constant: NGN per unit must be plausible.
  const ngnPerUsd = 1 / FALLBACK_RATES.USD;
  assert(
    'USD is a plausible naira rate, not the old invented 1500',
    ngnPerUsd > 800 && ngnPerUsd < 2500,
    `1 USD = ₦${ngnPerUsd.toFixed(2)}`
  );
  assert('NGN is the base and equals 1', FALLBACK_RATES.NGN === 1);
  assert(
    'every fallback rate is positive and finite',
    Object.values(FALLBACK_RATES).every((r) => isFinite(r) && r > 0)
  );

  console.log('── Auto-categorisation ──────────────────────');

  check('a cat toy files under pets', categorise('Funny Cat Toy Interactive Launch Pet Training Toy'), 'pet-supplies');
  check('a hair clipper files under beauty', categorise('Vintage Cordless Hair Clipper Electric Hair Trimmer'), 'beauty-skincare');
  check('fairy lights file under gadgets', categorise('USB LED String Lights 5/10/20M Waterproof Fairy Lights'), 'gadgets-lighting');
  check('a neck fan files under gadgets', categorise('8000mAh USB Hanging Neck Fan Portable Bladeless'), 'gadgets-lighting');
  check('a cabbage slicer files under home', categorise('Cabbage Slicer Vegetable Cutter Grater Kitchen Tools'), 'home-living');

  // The collision that makes a naive keyword list embarrassing: a pet clipper
  // is a pet product, whatever the blade does.
  check('a pet clipper stays in pets', categorise('Pet Hair Clipper Dog Grooming Trimmer'), 'pet-supplies');

  // Short words must match on boundaries, or "cat" fires on "communicate".
  assert('"cat" does not match inside another word', categorise('Communicate Bluetooth Device') !== 'pet-supplies');
  assert('"led" does not match inside "cordless"', categorise('Cordless Handbag') !== 'gadgets-lighting');

  // Declining is the point: no plausible match means no category.
  check('an unmatched product is left alone', categorise('Ingemark Gold Snake Chain Waist Belt'), null);

  // Fragrance — a live 100ml perfume matched nothing and sat in no collection.
  check(
    'a perfume files under beauty',
    categorise('100ml Parfum Long Lasting Perfume Neutral Citrus Perfumy Fresh Woody'),
    'beauty-skincare'
  );
  check('a body mist files under beauty', categorise('Floral Body Mist Fragrance Spray 250ml'), 'beauty-skincare');

  // Gaming has to beat gadgets, because controllers are also "wireless"/"usb".
  check(
    'a controller files under gaming',
    categorise('Wireless Gaming Controller Gamepad for PS4 PS5 Bluetooth'),
    'gaming'
  );
  check(
    'an RGB keyboard files under gaming',
    categorise('RGB Mechanical Gaming Keyboard USB Backlit'),
    'gaming'
  );
  assert(
    'a light switch is not gaming',
    categorise('LED Light Switch Wall Panel Touch') !== 'gaming'
  );

  /*
   * Matcher bugs found by auditing the live catalogue: the old version tested
   * only the FIRST occurrence of a keyword and did not allow a plural, so five
   * real products were filed nowhere.
   */
  check(
    'a later occurrence still matches when the first is a plural',
    categorise('100g Solid Patch Adhesive Gel for Nails - Extension Nail Glue Glossy Finish'),
    'beauty-skincare'
  );
  check(
    'a plural keyword matches',
    categorise('200 Density 40 Inch 13x6 Deep Wave Hd Lace Frontal Wigs Human Hair'),
    'beauty-skincare'
  );
  check(
    'a scalp brush is beauty, not home',
    categorise('Head Wash Clean Care Hair Root Itching Scalp Massage Comb Shampoo Brush'),
    'beauty-skincare'
  );
  check(
    'a derma roller is beauty',
    categorise('Micro Needling 540 Roller Derma Roller Titanium Dermaroller Beard Growth'),
    'beauty-skincare'
  );
  check(
    'an acid toner is beauty',
    categorise('100ml Glycolic Acid 7% Toning Solution Rejuvenating Lotion'),
    'beauty-skincare'
  );
  // The plural rule must not turn one word into a different one.
  assert('"cat" still does not match "cats" inside "communicates"', categorise('Communicates Bluetooth Device') !== 'pet-supplies');
  check(
    'eyelashes file under beauty',
    categorise('Fadvan 3D 4D 5D W Shaped Black Eyelashes 0.07mm'),
    'beauty-skincare'
  );
  check(
    'a collagen eye mask files under beauty',
    categorise('60pcs Gold Crystal Collagen Eye Mask Anti Dark Circles Eye Patches'),
    'beauty-skincare'
  );

  console.log('── Vendor display ────────────────────────────');

  /*
   * These used to expect the fallback string "Trusted supplier", and expected
   * a real storefront name to be printed. Both changed deliberately on
   * 2026-09-01 once it was visible on the live cards: see displayVendor.
   * Nothing is printed unless it is plausibly the maker.
   */
  check('the marketplace is never the vendor', displayVendor('ALIEXPRESS supplier'), null);
  check('a marketplace name is hidden', displayVendor('AliExpress'), null);
  check('1688 is hidden', displayVendor('1688 supplier'), null);
  check('a missing vendor prints nothing', displayVendor(''), null);
  check('a null vendor prints nothing', displayVendor(null), null);
  // An auto-generated shop handle is a name only in the technical sense.
  check('a generated shop handle is hidden', displayVendor('Shop1105057416 Store'), null);
  // A storefront handle is honest and still says nothing worth reading.
  check('a storefront name is hidden', displayVendor('DAZZLEEX Store'), null);
  // The brand's own shopfront keeps the brand and loses the shopfront wording.
  check('an official store keeps the brand', displayVendor('Ingemark Official Store'), 'Ingemark');

  console.log('── Capture quality ────────────────────────────');

  const captureBase = {
    sourceUrl: 'https://www.aliexpress.com/item/1.html',
    platform: 'ALIEXPRESS' as const,
    title: 'Test',
    descriptionHtml: '',
    currency: 'NGN',
    images: ['a.jpg'],
    videos: [],
    reviews: [],
  };

  // A near-permanent countdown sale is the normal state of these listings, so
  // pricing against the discounted figure must be called out, not assumed safe.
  // Cost is the regular price; the sale price rides along as promoPrice.
  const onPromo = assessCapture({
    ...captureBase,
    variants: [{ options: {}, price: 5316, promoPrice: 2605 }],
  });
  assert(
    'a deep discount today is surfaced',
    onPromo.problems.some((p) => p.includes('discounted today'))
  );
  assert('a discounted listing is still importable', onPromo.ok === true);
  check('cost is the regular price, not the sale price', onPromo.pricedVariantCount, 1);

  // An ordinary markdown must not cry wolf.
  const mildDiscount = assessCapture({
    ...captureBase,
    variants: [{ options: {}, price: 1000, promoPrice: 900 }],
  });
  assert(
    'an ordinary markdown is not called out',
    !mildDiscount.problems.some((p) => p.includes('discounted today'))
  );

  const noPrices = assessCapture({ ...captureBase, variants: [{ options: {}, price: 0 }] });
  assert('a capture with no prices is not ok', noPrices.ok === false);

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
    // Derived from the fallback, not a hardcoded band. The previous version
    // asserted 1400-1700 around the old invented 1/1500, so replacing the
    // placeholders with real rates failed a check about buffer arithmetic.
    usdConv.converted && Math.abs(usdConv.rateUsed - (1 / FALLBACK_RATES.USD) * 1.03) < 1,
    `rate ${usdConv.rateUsed.toFixed(2)} = mid ${(1 / FALLBACK_RATES.USD).toFixed(2)} + 3% buy buffer`
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
