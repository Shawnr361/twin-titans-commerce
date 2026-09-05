import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { fromMinor } from '@/lib/money';
import { CATEGORY_RULES, categorise } from '@/lib/categorise';

/**
 * The category string for a feed row, best source first.
 *
 * 1. `productType` — authoritative when set, though DSers imports never set it.
 * 2. The product's own collection — how the storefront actually files it.
 * 3. The store's categoriser, run over the title — the same rules that file a
 *    product on publish, so a product that simply has not been filed yet still
 *    reports the category it WOULD be filed under.
 *
 * The fallback matters: TikTok flags every row with no category, and a blank
 * cell means its optimiser has nothing to generalise from before the pixel has
 * purchase history of its own.
 */
function feedCategory(product: {
  title: string;
  productType: string | null;
  collections: { collection: { title: string } }[];
}): string {
  if (product.productType) return product.productType;
  if (product.collections[0]) return product.collections[0].collection.title;
  const handle = categorise(product.title, product.productType);
  return CATEGORY_RULES.find((rule) => rule.handle === handle)?.title ?? '';
}

/**
 * Product catalogue feed for Meta Commerce Manager and TikTok Catalog.
 *
 * One row per VARIANT, not per product. Both platforms buy and report against
 * the thing that has a price and a stock level, and a product-level row makes
 * "Black / Large is sold out" unrepresentable — the ad keeps running against
 * an item nobody can buy.
 *
 * The `id` column is the join key for the entire ad system: it must equal the
 * `content_ids` the pixel sends and the `id` the server-side Purchase sends,
 * or the platform records a conversion it cannot attribute to any catalogue
 * item and dynamic product ads have nothing to retarget with. Both senders use
 * `sku || variantId`, so this does too.
 *
 * Public by design — these are the same facts the storefront already shows,
 * and both platforms fetch it unauthenticated on a schedule.
 */

/*
 * force-dynamic is REQUIRED, not a default left in place.
 *
 * Without it Next tries to prerender this route at build time, and the build
 * machine has no production database — the build fails outright ("Export
 * encountered an error on /api/feed/products.csv"). `revalidate` cannot be used
 * alongside it either; the two contradict.
 *
 * So freshness is controlled at the CDN instead, via the explicit
 * `cache-control: public, max-age=3600` on the response below. That matters:
 * building this from the database takes 8-19s on this host and the platforms
 * pull it hourly, so an uncached origin hit risks a fetch timing out mid-pull —
 * and with the TikTok source set to "replace", a failed pull is not a harmless
 * retry.
 */
export const dynamic = 'force-dynamic';

/** RFC 4180: quote everything, double any embedded quote. Titles contain commas. */
function cell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/*
 * Two identifier columns, same value, on purpose.
 *
 * Meta's catalogue keys on `id`; TikTok's keys on `sku_id`. Emitting both lets
 * ONE feed URL serve both platforms, which matters because the id is the join
 * key for the whole ad system — the pixel's `content_ids`, the server-side
 * Purchase and the catalogue row must all agree, and maintaining two feeds is
 * how they drift apart.
 */
const COLUMNS = [
  'sku_id',
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'item_group_id',
  // Optional per the spec, but TikTok's ingest flags every row without it:
  // the category is what its optimiser uses to find lookalike demand before
  // the pixel has purchase history of its own to learn from.
  'product_type',
] as const;

export async function GET() {
  const [settings, products] = await Promise.all([
    getStoreSettings(),
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        variants: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
        /*
         * Collections are the only real category signal this catalogue has.
         * `Product.productType` exists in the schema but is null on every row —
         * DSers imports never set it — so a feed built on it ships 1,700 empty
         * category cells and TikTok flags every one of them.
         */
        collections: {
          include: { collection: true },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://twintitansemporium.store').replace(
    /\/$/,
    ''
  );

  const rows: string[] = [COLUMNS.join(',')];

  for (const product of products) {
    /*
     * Route to the marketing landing page when one exists, exactly as the
     * product cards and search do. Sending paid traffic to the plain product
     * page while organic traffic gets the landing page would make every ad
     * test measure the wrong page.
     */
    const link = product.landingPageHandle
      ? `${base}/pages/${product.landingPageHandle}`
      : `${base}/products/${product.handle}`;

    const description = product.seoDescription?.trim() || product.title;
    const image = product.images[0]?.url ?? '';
    // A feed row with no image is rejected on ingest, so do not emit one.
    if (!image) continue;

    for (const variant of product.variants) {
      const available = variant.inventory == null || variant.inventory > 0;
      rows.push(
        [
          cell(variant.sku || variant.id),
          cell(variant.sku || variant.id),
          cell(product.title),
          cell(description),
          cell(available ? 'in stock' : 'out of stock'),
          cell('new'),
          // "1999.00 NGN" — major units with the currency code, the format both
          // platforms parse. Minor units here would list a ₦19,999 product at
          // ₦1,999,900 and quietly destroy every ROAS figure downstream.
          cell(`${fromMinor(variant.priceMinor, settings.baseCurrency).toFixed(2)} ${settings.baseCurrency}`),
          cell(`${link}?utm_source=catalogue&utm_medium=paid`),
          cell(variant.imageUrl || image),
          cell(product.vendor || settings.storeName),
          // Groups a product's variants so the platforms show one listing with
          // options rather than five near-identical ads competing with each other.
          cell(product.handle),
          cell(feedCategory(product)),
        ].join(',')
      );
    }
  }

  return new Response(rows.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'content-disposition': 'inline; filename="twin-titans-products.csv"',
    },
  });
}
