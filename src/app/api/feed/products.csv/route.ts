import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { displayConvert, fromMinor } from '@/lib/money';
import { CATEGORY_RULES, categorise } from '@/lib/categorise';
import { htmlToText } from '@/lib/seo';

/**
 * A variant's option value by any of the names suppliers use for it.
 *
 * Google asks for color and size on variant products and flags rows without
 * them; Meta and TikTok read the same columns. Only exact option names are
 * matched — guessing "Style" is a colour would publish a wrong attribute.
 */
function optionValue(options: unknown, names: string[]): string {
  if (!options || typeof options !== 'object') return '';
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (names.includes(key.trim().toLowerCase()) && typeof value === 'string') return value.trim();
  }
  return '';
}

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
 * The store's own category names mapped onto Google's product taxonomy.
 *
 * TikTok and Meta both ask for `google_product_category` and flag every row
 * without one. Only the top level of the taxonomy is used deliberately: the
 * deeper paths are exact strings that must match Google's list character for
 * character, and a wrong path is treated as no path at all. A correct broad
 * category beats a plausible-looking specific one that silently fails.
 */
const GOOGLE_TAXONOMY: Record<string, string> = {
  'Beauty & Skincare': 'Health & Beauty',
  'Pet Supplies': 'Animals & Pet Supplies',
  'Home & Living': 'Home & Garden',
  'Gadgets & Lighting': 'Electronics',
  Gaming: 'Electronics',
};

/**
 * Products that must never enter an ad catalogue, however well they sell.
 *
 * This is an ADVERTISING filter, not a catalogue one — the product stays on the
 * storefront and sells exactly as before. It simply is not handed to Meta or
 * TikTok, because both prohibit medical devices, and an ad account does not get
 * warned politely: rejected ads accumulate against account standing and a
 * prohibited-goods strike can take the whole account down, along with the pixel
 * history and every campaign attached to it.
 *
 * Kept deliberately narrow and literal. A broad term like "needle" would catch
 * the sewing kit; the cost of a false positive here is a product silently
 * missing from every ad, which is exactly the kind of quiet loss nobody notices.
 */
const AD_EXCLUDED_TERMS = ['acupuncture'];

function excludedFromAds(title: string): boolean {
  const hay = title.toLowerCase();
  return AD_EXCLUDED_TERMS.some((term) => hay.includes(term));
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
  // Both platforms ask for their own taxonomy field alongside product_type.
  'google_product_category',
  'color',
  'size',
] as const;

export async function GET(request: Request) {
  /*
   * Which channel is reading. The ad catalogues keep the paid UTM tags they
   * were set up with; Google Merchant Center reads ?channel=google, so free
   * Shopping listings are not reported as paid traffic in analytics.
   */
  const query = new URL(request.url).searchParams;
  const channel = query.get('channel');
  const isGoogle = channel === 'google';
  const utm = isGoogle
    ? 'utm_source=google&utm_medium=organic_shopping'
    : 'utm_source=catalogue&utm_medium=paid';

  /*
   * ?currency=GBP — one Google Shopping feed per local currency.
   *
   * Google limits a naira-priced listing in the UK, the US and the euro area
   * ("unsupported currency"), so each of those markets gets its own feed priced
   * in its own money. The figure is converted with the SAME stored rate and the
   * SAME rounding (displayConvert) the storefront uses, and every link carries
   * the currency so the page renders that figure server-side — Google compares
   * the two, and a mismatch disapproves the product.
   *
   * This is a DISPLAY price. Checkout still settles in naira (Flutterwave) or
   * USD (PayPal), as it always has for shoppers who switch currency by hand.
   */
  const requested = query.get('currency')?.toUpperCase() ?? null;
  const [settings, rateRow] = await Promise.all([
    getStoreSettings(),
    requested
      ? prisma.fxRate.findFirst({ where: { code: requested }, select: { rate: true } }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const converting = Boolean(requested && requested !== settings.baseCurrency);
  if (converting && !(rateRow && rateRow.rate > 0)) {
    return new Response(`No exchange rate is stored for ${requested}.`, { status: 400 });
  }
  const feedCurrency = converting ? requested! : settings.baseCurrency;
  const priceText = (minor: number) =>
    converting
      ? `${displayConvert(minor, rateRow!.rate).toFixed(2)} ${feedCurrency}`
      : `${fromMinor(minor, settings.baseCurrency).toFixed(2)} ${feedCurrency}`;
  const linkQuery = converting ? `${utm}&currency=${feedCurrency}` : utm;

  const [products] = await Promise.all([
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
    // Google gets the product page itself: that is where the structured-data
    // price it verifies against lives, in whatever currency the link names.
    const link =
      product.landingPageHandle && !isGoogle
        ? `${base}/pages/${product.landingPageHandle}`
        : `${base}/products/${product.handle}`;

    /*
     * The written description, as plain text. This used to fall back to the
     * title, so most rows said the same thing twice — Google scores that as a
     * missing description. Capped at Google's 5,000 characters.
     */
    const description = (
      product.seoDescription?.trim() ||
      htmlToText(product.descriptionHtml ?? '').trim() ||
      product.title
    ).slice(0, 5000);
    const image = product.images[0]?.url ?? '';
    // A feed row with no image is rejected on ingest, so do not emit one.
    if (!image) continue;

    // Restricted goods never reach an ad platform. Still sold on the storefront.
    if (excludedFromAds(product.title)) continue;

    const category = feedCategory(product);

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
          cell(priceText(variant.priceMinor)),
          // Google checks each option's own price, so its link opens that option.
          cell(
            isGoogle
              ? `${link}?${linkQuery}&variant=${encodeURIComponent(variant.sku || variant.id)}`
              : `${link}?${linkQuery}`
          ),
          cell(variant.imageUrl || image),
          cell(product.vendor || settings.storeName),
          // Groups a product's variants so the platforms show one listing with
          // options rather than five near-identical ads competing with each other.
          cell(product.handle),
          cell(category),
          cell(GOOGLE_TAXONOMY[category] ?? ''),
          cell(optionValue(variant.optionValues, ['color', 'colour', 'color name'])),
          cell(optionValue(variant.optionValues, ['size', 'sizes', 'shoe size'])),
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
