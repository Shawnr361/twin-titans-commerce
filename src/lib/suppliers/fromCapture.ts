import { realVariants } from './variants';
import type { CapturedProduct } from './capture';
import type { NormalizedProduct, NormalizedVariant } from './types';
import type { PreviewResult } from './import';
import { computePrice, type PricingRules } from '../pricing';
import { getPricingRules, getStoreSettings } from '../settings';
import { sourceCostToBase } from '../fx';
import { toMinor } from '../money';
import { prisma } from '../db';

/**
 * Turn a browser capture into the same PreviewResult the URL importer produces.
 *
 * Deliberately reuses the identical pricing path — per-variant landed cost,
 * supplier shipping folded in, gateway fee inside the solve. A capture must not
 * get a second, more permissive pricing route; the guarantee that no variant
 * can be published below its own cost has to hold no matter how the product
 * arrived.
 */
export async function previewFromCapture(
  captureId: string,
  overrideRules?: Partial<PricingRules>
): Promise<PreviewResult & { captureId: string; videos: string[]; reviewCount: number }> {
  const row = await prisma.supplierCapture.findUnique({ where: { id: captureId } });
  if (!row) throw new Error('That capture no longer exists.');

  const captured = row.payload as unknown as CapturedProduct;

  const settings = await getStoreSettings();
  const storedRules = await getPricingRules();
  const rules: PricingRules = { ...storedRules, ...overrideRules };

  // A capture with no variants still deserves a row, so the merchant can type
  // the cost by hand rather than being stuck with nothing to edit.
  const captureVariants =
    captured.variants.length > 0
      ? captured.variants
      : [{ options: {}, price: 0, skuId: undefined, imageUrl: undefined }];

  /*
   * Drop the attribute-less padding SKUs before anything downstream sees them,
   * so a one-colour product never gains a phantom "Option 2". See realVariants.
   */
  /*
   * The return type is annotated deliberately. Without it this was a plain
   * object literal returned from .map(), which TypeScript only checks for
   * ASSIGNABILITY — every field on NormalizedVariant is optional, so writing
   * `supplierVariantId` (a name that does not exist on it) compiled cleanly
   * while the SKU went nowhere. Every product in the catalogue ended up with a
   * null supplier SKU, which is what made automatic supplier ordering refuse on
   * all of them. Annotating the arrow turns the same mistake into a build error.
   */
  const variants: NormalizedVariant[] = realVariants(captureVariants).map(
    (v): NormalizedVariant => ({
      options: v.options ?? {},
      costMinor: toMinor(v.price ?? 0, captured.currency),
      imageUrl: v.imageUrl,
      externalVariantId: v.skuId,
      stock: v.stock ?? null,
    })
  );

  // Option names in the order the supplier presented them, so the variant
  // picker reads "Colour" then "Plug" rather than an arbitrary object order.
  const optionNames = Array.from(
    captureVariants.reduce<Set<string>>((set, v) => {
      Object.keys(v.options ?? {}).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );

  // Headline cost = the cheapest variant, matching how the URL importer
  // reports a product-level figure.
  const cheapestCost = variants.reduce(
    (min, v) => (v.costMinor > 0 && v.costMinor < min ? v.costMinor : min),
    Number.MAX_SAFE_INTEGER
  );

  const product: NormalizedProduct = {
    platform: captured.platform as NormalizedProduct['platform'],
    externalId: captured.externalId ?? '',
    sourceUrl: captured.sourceUrl,
    title: captured.title,
    optionNames,
    costMinor: cheapestCost === Number.MAX_SAFE_INTEGER ? 0 : cheapestCost,
    descriptionHtml: captured.descriptionHtml ?? '',
    images: captured.images ?? [],
    currency: captured.currency,
    variants,
    shippingCostMinor: toMinor(captured.shippingCost ?? 0, captured.currency),
    /*
     * Videos travel in raw because there is no column for them, and adding one
     * means a migration against MySQL on shared hosting for what is a list of
     * URLs. SupplierProduct.raw is already stored per product and was otherwise
     * unused on this path, so the product page reads them back from here.
     */
    raw: { videos: captured.videos ?? [] },
    supplierName: captured.supplierName,
    supplierStoreUrl: captured.supplierStoreUrl,
    shipsFrom: captured.shipsFrom,
    rating: captured.rating,
    reviewCount: captured.reviewCount,
    ordersCount: captured.ordersCount,
    provenance: 'page',
    warnings: [],
  };

  const perUnitShipping = product.shippingCostMinor;
  /*
   * undefined and 0 mean very different things here. Zero is "the supplier
   * states this ships free"; undefined is "we could not read it". Collapsing
   * them prices delivery at nothing and overstates every margin on the
   * product, which is the exact bug the landed-cost model exists to prevent.
   */
  const shippingUnknown = captured.shippingCost == null;
  let fxRateUsed = 1;
  const pricing: PreviewResult['pricing'] = [];

  for (const variant of product.variants) {
    const sourceTotal = variant.costMinor + perUnitShipping;
    const { baseMinor, rateUsed, converted } = await sourceCostToBase(
      sourceTotal,
      product.currency,
      settings.baseCurrency
    );
    // A failed conversion reports rate 0; keep the last real rate for display.
    if (converted) fxRateUsed = rateUsed;

    const result = computePrice(baseMinor, rules);
    const label =
      Object.entries(variant.options)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' / ') || 'Default';

    pricing.push({
      optionLabel: label,
      sourceCostMinor: variant.costMinor,
      landedCostMinor: baseMinor,
      priceMinor: result.priceMinor,
      compareAtMinor: result.compareAtMinor,
      profitMinor: result.profitMinor,
      marginPct: result.marginPct,
      warnings: [
        ...result.warnings,
        ...(converted
          ? []
          : [
              `No exchange rate for ${product.currency} — landed cost could not be calculated. Add a rate in Settings, or enter the cost by hand.`,
            ]),
        ...(variant.costMinor === 0
          ? ['No price captured for this option — enter the cost by hand.']
          : []),
        ...(shippingUnknown
          ? [
              'Supplier delivery was not stated as free and could not be read — this landed cost excludes shipping. Confirm it before publishing.',
            ]
          : []),
      ],
    });
  }

  let alreadyImported: PreviewResult['alreadyImported'] = null;
  if (captured.externalId) {
    const existing = await prisma.supplierProduct
      .findUnique({
        where: {
          platform_externalId: {
            platform: captured.platform as never,
            externalId: captured.externalId,
          },
        },
        include: { product: { select: { id: true, handle: true, title: true } } },
      })
      .catch(() => null);

    if (existing?.product) {
      alreadyImported = {
        productId: existing.product.id,
        handle: existing.product.handle,
        title: existing.product.title,
      };
    }
  }

  return {
    product,
    pricing,
    baseCurrency: settings.baseCurrency,
    fxRateUsed,
    alreadyImported,
    captureId: row.id,
    videos: captured.videos ?? [],
    reviewCount: captured.reviews?.length ?? 0,
  };
}
