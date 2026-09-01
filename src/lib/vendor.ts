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

/**
 * Kept only for the internal admin surfaces, which do want to know that a
 * product came from somewhere unnamed. Nothing customer-facing prints it.
 */
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

/**
 * The vendor line as a customer should see it, or null to print nothing.
 *
 * CHANGED ON PURPOSE, 2026-09-01. This used to show any real store name, on
 * the reasoning that "DAZZLEEX Store" is honest — it really is who supplies
 * the item. Seeing it on the live storefront settled the argument the other
 * way. Every single non-null vendor in the catalogue was a marketplace
 * storefront handle: "ASWESAW GLOBAL LIGHTING OFFICIAL STORE", "Cxbfg Nanabling
 * Shadow Store", "Best Of You Store". Set in caps above the product name, on
 * the first line a shopper reads, they say nothing about the product and quite
 * a lot about where it was bought. Honest, and still worse than silence.
 *
 * The old fallback was worse again: an unnamed supplier printed "Trusted
 * supplier", which is an unverifiable boast in exactly the family of claims
 * this codebase strips everywhere else.
 *
 * So the rule is now the same one used for schema.org brand: print a name only
 * when it is plausibly the maker, otherwise print nothing at all. A shopper
 * loses nothing — the supplier is still recorded internally on the Supplier
 * record, which is where reordering reads it from.
 */
/**
 * A brand hiding inside an official-store handle.
 *
 * "<X> Official Store" is a marketplace's wording for a shopfront the brand
 * itself runs, so X really is the maker — Ajazz, EMEET, NATUHANA and KODO all
 * reach us that way, and deleting the whole handle throws away the one part of
 * it worth keeping. A plain "<X> Store" means no such thing: that is simply
 * what every seller on the platform calls itself.
 *
 * Only one or two words are accepted in front of "Official Store". "Ajazz
 * Official Store" is a brand; "Ibcccndc Lakerain Global Cosmetics Flagship
 * Store" is a search-term salad, and publishing that as the product's brand
 * would be a false claim to Google that cannot easily be retracted once indexed.
 */
function brandInsideOfficialStore(name: string): string | null {
  const match = name.match(/^(.+?)\sofficial\s(?:flagship\s)?store$/i);
  if (!match) return null;
  const brand = match[1].trim();
  return brand.split(/\s+/).length <= 2 && brand.length <= 22 ? brand : null;
}

/**
 * The vendor as a customer should see it, or null when there is nothing worth
 * printing.
 *
 * ONE rule, shared by the storefront line, by schema.org `brand` and by the
 * importer — a name must never be good enough for one surface and not another,
 * which is exactly how "ALIEXPRESS supplier" reached the product cards while
 * being refused as a brand.
 */
export function normaliseVendor(vendor?: string | null): string | null {
  const name = (vendor ?? '').trim();
  if (!name || isMarketplaceName(name)) return null;

  const brand = brandInsideOfficialStore(name);
  if (brand) return brand;

  // "... Store", "... Factory Store", "... Co., Ltd" — how a marketplace seller
  // names its shopfront, never how a maker names itself. A genuine brand
  // ("COSRX", "Kiko") survives this untouched.
  if (/\b(store|shop|factory|trading|co\.?,?\s*ltd\.?|official\s*flagship)\s*$/i.test(name)) {
    return null;
  }
  return name;
}

/** The vendor line as a customer should see it. */
export function displayVendor(vendor?: string | null): string | null {
  return normaliseVendor(vendor);
}

/**
 * Whether a vendor may be published as schema.org `brand`.
 *
 * Deliberately the same test as the storefront now: publishing a name to a
 * shopper that we will not publish to Google (or the reverse) means one of the
 * two is wrong.
 */
export function isPublishableBrand(vendor?: string | null): boolean {
  return normaliseVendor(vendor) !== null;
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
