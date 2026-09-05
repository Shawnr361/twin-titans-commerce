import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { call } from '@/lib/suppliers/aliexpress-api';

export const dynamic = 'force-dynamic';

/**
 * Read back what AliExpress ACTUALLY charges for one SKU, and what delivery
 * costs on top of it. Read-only: this writes nothing, anywhere.
 *
 * WHY THIS EXISTS
 * ---------------
 * Order #20 was costed at ₦3,526.08 for the KIKO lip gloss and AliExpress
 * charged US $6.19 — $4.20 for the item and $1.99 to ship it. At the stored
 * rate of ₦1,351.35/USD our figure was $2.61, so the landed cost was understated
 * roughly 2.4x, and the margin audit reported the whole catalogue healthy
 * against it. Two separate faults produced that:
 *
 *   1. Delivery is missing entirely. captureFromApi never sets shippingCost, so
 *      every API-imported product lands with `shippingCostMinor = 0` — the
 *      landed-cost model's own "unknown vs free" distinction is defeated
 *      because undefined becomes 0 by the time it reaches the arithmetic.
 *   2. The item price itself is wrong. $2.61 is exactly promo x 1.2 on a promo
 *      of $2.174, which means supplierCostBasis was applied to a promotional
 *      figure that is NOT what the account is billed for the chosen SKU.
 *
 * Fixing either by guessing at field names would be guessing twice. This dumps
 * the real reply so the arithmetic can be built against what is actually there
 * — the same rule that settled sku_attr and result.order_list.number[0].
 *
 * THE FREIGHT METHOD NAME IS DISCOVERED, NOT ASSUMED
 * --------------------------------------------------
 * The SDK documents the SHAPE of the shipping call (country_code, product_id,
 * product_num, province_code, city_code, send_goods_country_code, price) but
 * not the method string, and the published API list does not either. So the
 * candidates below are each tried once and the reply reported verbatim. When
 * one answers, its name goes into the cost model; until then nothing is
 * hardcoded on a hunch.
 */
const FREIGHT_METHODS = [
  'aliexpress.ds.freight.query',
  'aliexpress.logistics.buyer.freight.calculate',
  'aliexpress.ds.shipping.info.get',
  'aliexpress.ds.product.shipping.get',
];

/** Pull every price-looking field out of a SKU node, whatever it is called. */
function priceFields(node: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (v: unknown, path: string) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const here = path ? `${path}.${k}` : k;
      if (
        (typeof val === 'string' || typeof val === 'number') &&
        /price|amount|discount|fee|cost|currency/i.test(k)
      ) {
        out[here] = val;
      }
      if (val && typeof val === 'object') walk(val, here);
    }
  };
  walk(node, '');
  return out;
}

/** Find the SKU node matching a sku id, wherever the reply hides it. */
function findSku(body: unknown, skuId: string): unknown | null {
  let hit: unknown = null;
  const walk = (v: unknown) => {
    if (hit || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const record = v as Record<string, unknown>;
    for (const [k, val] of Object.entries(record)) {
      if (hit) return;
      if (/sku_?id/i.test(k) && String(val) === skuId) {
        hit = record;
        return;
      }
      walk(val);
    }
  };
  walk(body);
  return hit;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get('productId') ?? '';
  const skuId = url.searchParams.get('skuId') ?? '';
  const country = url.searchParams.get('country') ?? 'GB';

  if (!productId) {
    return NextResponse.json(
      { error: 'Pass ?productId=<aliexpress item id>&skuId=<sku>&country=GB' },
      { status: 400 }
    );
  }

  const product = await call('aliexpress.ds.product.get', {
    product_id: productId,
    ship_to_country: country,
    target_currency: 'USD',
    target_language: 'EN',
  });

  const sku = skuId ? findSku(product.body, skuId) : null;

  /*
   * One attempt per candidate, and the reply kept either way — a method that
   * does not exist answers with an error naming itself, which is just as
   * useful as a success for deciding which one to build on.
   */
  const freight: Record<string, unknown> = {};
  for (const method of FREIGHT_METHODS) {
    const res = await call(method, {
      product_id: productId,
      country_code: country,
      send_goods_country_code: 'CN',
      product_num: '1',
      ...(skuId ? { sku_id: skuId } : {}),
    });
    freight[method] = {
      ok: res.ok,
      body: JSON.stringify(res.body).slice(0, 900),
    };
  }

  return NextResponse.json({
    productId,
    skuId,
    country,
    skuFound: Boolean(sku),
    /* The whole point: their field names and values, not our interpretation. */
    skuPriceFields: sku ? priceFields(sku) : null,
    productPriceFields: priceFields(product.body),
    freight,
  });
}
