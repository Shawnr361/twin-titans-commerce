import { call } from '@/lib/suppliers/aliexpress-api';

/**
 * What AliExpress charges to DELIVER one item, and by which service.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every product imported through the API landed with no shipping cost at all.
 * captureFromApi never set `shippingCost`, so fromCapture's careful distinction
 * between "the supplier ships this free" (0) and "we could not read it"
 * (undefined) was defeated: the field was simply never populated, the landed
 * cost was the item price alone, and the margin audit then reported the whole
 * catalogue healthy against it.
 *
 * On the KIKO lip gloss that omission was $1.99 against a $4.20 item — 47% of
 * the goods cost, missing. Verified against the real invoice for AliExpress
 * order 3076322850022701: $4.20 + $1.99 = $6.19.
 *
 * THE METHOD AND ITS WRAPPER WERE DISCOVERED, NOT GUESSED
 * ------------------------------------------------------
 * `aliexpress.ds.freight.query` takes a single JSON-encoded `queryDeliveryReq`,
 * the same way order.create takes param_place_order_request4_open_api_d_t_o.
 * Neither the SDK nor the published API list documents this; the API named the
 * parameter itself when called without it, which is how it was settled.
 *
 * SHIPPING IS NOT A FLAT ADDER
 * ----------------------------
 * The reply carries `free_shipping_threshold` — US $10.00 on that listing —
 * which is why the $19.13 curling iron on the same order shipped free while
 * the $4.20 lip gloss did not. Costing every unit at the same fee would
 * overstate the dear items and understate nothing; costing everything at zero
 * understates the cheap ones, which is the expensive direction. So the
 * threshold is returned and applied against the actual line value.
 */

export interface FreightQuote {
  /** Delivery cost for the quantity asked about, in `currency`. */
  shippingFee: number;
  currency: string;
  freeShipping: boolean;
  /** Order value above which this service ships free, in `currency`. */
  freeShippingThreshold: number | null;
  /** The service code — feed this to order.create, do not hardcode one. */
  serviceCode: string | null;
  company: string | null;
  minDays: number | null;
  maxDays: number | null;
}

/** "US $10.00" / "$1.99" / "1.99" -> 1.99. Returns null when there is no number. */
function money(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const match = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Find the delivery options array wherever the reply nests it. */
function optionsOf(body: unknown): Record<string, unknown>[] {
  let found: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (found.length || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (found.length) return;
      if (/delivery_option_d_t_o|deliveryOptionDTO/i.test(k) && Array.isArray(val)) {
        found = val.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object');
        return;
      }
      walk(val);
    }
  };
  walk(body);
  return found;
}

/**
 * The cheapest tracked option, because that is what a dropshipper actually
 * buys — an untracked service saves cents and costs the dispute.
 */
function pickOption(options: Record<string, unknown>[]): Record<string, unknown> | null {
  if (options.length === 0) return null;
  const tracked = options.filter((o) => o.tracking === true);
  const pool = tracked.length > 0 ? tracked : options;
  return pool.reduce((best, o) => {
    /*
     * `shipping_fee_cent` is NOT cents despite the name — it holds "1.99"
     * alongside shipping_fee_format "US $1.99". Reading it as minor units
     * would price delivery at two cents and reintroduce the very bug this
     * module exists to fix.
     */
    const fee = money(o.shipping_fee_cent ?? o.shipping_fee_format) ?? Number.MAX_SAFE_INTEGER;
    const bestFee =
      money(best.shipping_fee_cent ?? best.shipping_fee_format) ?? Number.MAX_SAFE_INTEGER;
    return fee < bestFee ? o : best;
  });
}

/**
 * Ask what delivery costs for one listing to one country.
 *
 * Returns null rather than zero when the answer cannot be had. Zero means
 * "ships free" everywhere else in the costing model, and turning an outage
 * into free delivery is exactly how a catalogue ends up underpriced.
 */
export async function freightFor(
  productId: string,
  /*
   * REQUIRED, not optional.
   *
   * Called without it the API answers "The input parameter selectedSkuId that
   * is mandatory for processing this request is not supplied" — and the first
   * version of the pricing audit did exactly that, once per product. Every
   * quote failed, every failure became null, and null was read as zero
   * shipping: the audit silently reproduced the very fault it was written to
   * catch, and reported the catalogue clean. The type now makes that
   * impossible to write by accident.
   */
  skuId: string,
  country: string,
  quantity = 1
): Promise<FreightQuote | null> {
  if (!skuId) return null;

  const request: Record<string, unknown> = {
    quantity,
    shipToCountry: country,
    productId: Number(productId),
    selectedSkuId: skuId,
    language: 'en_US',
    locale: 'en_US',
    currency: 'USD',
    source: 'api',
  };

  let res;
  try {
    res = await call('aliexpress.ds.freight.query', {
      queryDeliveryReq: JSON.stringify(request),
    });
  } catch {
    return null;
  }

  const option = pickOption(optionsOf(res.body));
  if (!option) return null;

  const fee = money(option.shipping_fee_cent ?? option.shipping_fee_format);
  if (fee === null) return null;

  return {
    shippingFee: fee,
    currency: String(option.shipping_fee_currency ?? 'USD'),
    freeShipping: option.free_shipping === true,
    freeShippingThreshold: money(option.free_shipping_threshold),
    serviceCode: option.code ? String(option.code) : null,
    company: option.company ? String(option.company) : null,
    minDays: typeof option.min_delivery_days === 'number' ? option.min_delivery_days : null,
    maxDays: typeof option.max_delivery_days === 'number' ? option.max_delivery_days : null,
  };
}

/**
 * What delivery really costs on a line, given the threshold.
 *
 * A quote of $1.99 with a $10 threshold costs $1.99 on a $4.20 item and
 * nothing on a $19.13 one. Applying the fee flat would overstate the dear
 * items; ignoring it understates the cheap ones. Only the second direction
 * loses money, but both make the margin figure a guess.
 */
export function shippingOnLine(quote: FreightQuote | null, lineValue: number): number | null {
  if (!quote) return null;
  if (quote.freeShipping) return 0;
  if (quote.freeShippingThreshold !== null && lineValue >= quote.freeShippingThreshold) return 0;
  return quote.shippingFee;
}
