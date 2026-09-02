import { call } from './aliexpress-api';

/**
 * Ask AliExpress for a listing's SKU ids, and match them to our variants.
 *
 * ONE COPY OF THIS RULE, ON PURPOSE.
 *
 * Both the importer (so new products arrive with SKUs) and the recovery route
 * (so old ones get them back) need exactly this matching. Written twice they
 * would drift, and the failure mode of drift here is ordering the wrong colour
 * — which nobody discovers until a customer opens the parcel.
 */

export interface SupplierSku {
  id: string;
  /** "14:365458#Red;5:361386#XL" */
  attr: string;
}

/** The human-readable half of each attribute: everything after the '#'. */
export function readableValues(skuAttr: string): string[] {
  return skuAttr
    .split(';')
    .map((part) => part.split('#')[1] ?? '')
    .map((v) => {
      try {
        return decodeURIComponent(v).trim().toLowerCase();
      } catch {
        return v.trim().toLowerCase();
      }
    })
    .filter(Boolean);
}

export function optionValuesOf(options: unknown): string[] {
  if (!options || typeof options !== 'object') return [];
  return Object.values(options as Record<string, unknown>)
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter(Boolean);
}

/** Every {sku_id, sku_attr} pair anywhere in a nested reply. */
export function collectSkus(body: unknown): SupplierSku[] {
  const found: SupplierSku[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const row = v as Record<string, unknown>;
    const id = row.sku_id ?? row.skuId;
    const attr = row.sku_attr ?? row.skuAttr ?? row.sku_property ?? '';
    if ((typeof id === 'string' || typeof id === 'number') && typeof attr === 'string') {
      found.push({ id: String(id), attr });
    }
    Object.values(row).forEach(walk);
  };
  walk(body);
  return found;
}

/**
 * The SKU for one variant, or null when it cannot be known.
 *
 * Every stored option value must appear in the SKU's readable values. A partial
 * match is a guess, and a guessed SKU ships the wrong item — so this returns
 * null rather than the closest thing it found.
 *
 * The one exception is a variant with no options at all against a listing with
 * exactly one SKU: there is nothing to choose between, so the match is certain.
 */
export function matchSku(options: unknown, skus: SupplierSku[]): string | null {
  const wanted = optionValuesOf(options);
  if (wanted.length === 0) return skus.length === 1 ? skus[0].id : null;

  const hit = skus.find((s) => {
    const have = readableValues(s.attr);
    return wanted.every((w) => have.includes(w));
  });
  return hit?.id ?? null;
}

/**
 * Fetch a listing's SKUs. Returns an empty list rather than throwing: this is
 * an enrichment, and an import must never fail because a lookup did.
 */
export async function fetchSkus(productId: string): Promise<SupplierSku[]> {
  try {
    const res = await call('aliexpress.ds.product.get', {
      product_id: productId,
      ship_to_country: 'NG',
      target_currency: 'USD',
      target_language: 'en',
    });
    return collectSkus(res.body);
  } catch {
    return [];
  }
}
