/**
 * What to print where a product's vendor goes.
 *
 * The marketplace is not the vendor. When a listing carries no store name the
 * importer used to fall back to "<PLATFORM> supplier", which put ALIEXPRESS
 * SUPPLIER on the storefront — telling a customer where we buy rather than who
 * makes it, which is both unhelpful and not something to advertise.
 *
 * Machine-generated shop handles are treated the same way: "Shop1105057416
 * Store" is a name in the technical sense only and reads as a database id.
 *
 * A real store name is still shown, because that is genuine information.
 */
const MARKETPLACES = ['aliexpress', 'alibaba', '1688', 'taobao', 'ali express'];

export const FALLBACK_VENDOR = 'Trusted supplier';

export function isMarketplaceName(vendor?: string | null): boolean {
  const name = (vendor ?? '').trim().toLowerCase();
  if (!name) return true;
  if (MARKETPLACES.some((m) => name.includes(m))) return true;
  // "shop1105057416 store", "store no.1234" and similar auto-generated handles.
  if (/^shop\s*\d+/.test(name)) return true;
  if (/^store\s*(no\.?)?\s*\d+/.test(name)) return true;
  if (name === 'supplier' || name === 'store') return true;
  return false;
}

/** The vendor line as a customer should see it. */
export function displayVendor(vendor?: string | null): string {
  const name = (vendor ?? '').trim();
  return isMarketplaceName(name) ? FALLBACK_VENDOR : name;
}

/**
 * Whether a vendor may be published as schema.org `brand`.
 *
 * Stricter than the storefront rule on purpose. Showing "DAZZLEEX Store" as
 * the vendor line is honest - that really is who supplies it - but declaring
 * it as the product's BRAND tells Google the supplier's shop handle is the
 * manufacturer, and marketplace sellers name themselves "<something> Store"
 * almost universally. Google treats brand as recommended rather than required,
 * so omitting it costs a warning while publishing a false one is a claim we
 * cannot stand behind and cannot easily retract once indexed.
 */
export function isPublishableBrand(vendor?: string | null): boolean {
  const name = (vendor ?? '').trim();
  if (!name || isMarketplaceName(name)) return false;
  return !/\sstore$/i.test(name);
}
