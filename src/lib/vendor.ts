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

/**
 * A variant title fit to show a customer, or null when there is nothing to say.
 *
 * Single-variant products are stored with the placeholder title "Default",
 * because a variant row has to be called something. That is an internal
 * detail: printing "Default" beside a product tells a shopper nothing and
 * reads like a bug.
 *
 * Four surfaces already tested for it by hand and four did not, which is how
 * "Default" reached the order confirmation, the tracking page and the order
 * detail. One helper so a new surface cannot forget.
 */
export function variantLabel(title?: string | null): string | null {
  const name = (title ?? '').trim();
  if (!name || name.toLowerCase() === 'default') return null;
  return name;
}

/**
 * Labels for a variant picker that a customer can actually tell apart.
 *
 * Captures do not always resolve an option name for every SKU. optionLabel()
 * falls back to the literal string "Default" per variant, so a listing where
 * only some colours were readable renders as six identical "Default" buttons
 * beside Green, Red and Yellow — unusable, and it reads as a broken page.
 *
 * Rules:
 *  - a real, unique name is shown untouched;
 *  - a placeholder becomes "Option N", numbered by position so it still
 *    corresponds to the supplier's own ordering;
 *  - a genuinely repeated name keeps the name and gains an occurrence number,
 *    because "Red" twice is still more informative than "Option 7".
 */
export function pickerLabels(titles: string[]): string[] {
  const cleaned = titles.map((t) => variantLabel(stripOptionName(t)) ?? '');

  const totals = new Map<string, number>();
  for (const name of cleaned) {
    if (name) totals.set(name, (totals.get(name) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return cleaned.map((name, i) => {
    if (!name) return `Option ${i + 1}`;
    if ((totals.get(name) ?? 0) === 1) return name;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return `${name} (${n})`;
  });
}

/** "Color: Red" -> "Red"; the option NAME is already the picker's legend. */
function stripOptionName(title: string): string {
  return title
    .split(' / ')
    .map((part) => {
      const at = part.indexOf(': ');
      return at > -1 ? part.slice(at + 2) : part;
    })
    .join(' / ');
}
