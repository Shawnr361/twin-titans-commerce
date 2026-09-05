import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { fromMinor } from '@/lib/money';

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

export const dynamic = 'force-dynamic';
// Re-fetched by the platforms on their own schedule; an hour of staleness is
// cheaper than rebuilding the whole catalogue on every crawl.
export const revalidate = 3600;

/** RFC 4180: quote everything, double any embedded quote. Titles contain commas. */
function cell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const COLUMNS = [
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
] as const;

export async function GET() {
  const [settings, products] = await Promise.all([
    getStoreSettings(),
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        variants: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
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
