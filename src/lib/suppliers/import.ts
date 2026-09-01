import { variantLabel } from '@/lib/vendor';
import { cleanOptionLabels } from './optionLabel';
import { prisma } from '../db';
import { sourceCostToBase } from '../fx';
import { normaliseVendor } from '../vendor';
import { categorise } from '../categorise';
import { computePrice, type PricingRules } from '../pricing';
import { getPricingRules, getStoreSettings } from '../settings';
import { adapterFor, genericAdapter } from './adapters';
import { parseSupplierUrl, resolveShortLink } from './parse';
import { cleanProductTitle } from './title';
import type { NormalizedProduct, Platform } from './types';

/**
 * The "paste a supplier link" pipeline — the whole point of owning this stack.
 *
 *   URL -> resolve -> parse platform+id -> fetch listing -> normalize
 *       -> convert cost to base currency -> price every variant individually
 *       -> create product (as a DRAFT, always)
 *
 * Nothing here publishes. A new product lands as a draft with its margin
 * warnings attached, and going live is a deliberate act.
 */

export interface PreviewResult {
  product: NormalizedProduct;
  /** Per-variant pricing proposal, aligned by index with product.variants. */
  pricing: {
    optionLabel: string;
    sourceCostMinor: number;
    landedCostMinor: number;
    priceMinor: number;
    compareAtMinor: number | null;
    profitMinor: number;
    marginPct: number;
    warnings: string[];
  }[];
  baseCurrency: string;
  fxRateUsed: number;
  alreadyImported: { productId: string; handle: string; title: string } | null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70)
    .replace(/^-|-$/g, '');
}

async function uniqueHandle(base: string): Promise<string> {
  const root = base || 'product';
  let handle = root;
  for (let i = 2; i < 200; i++) {
    const clash = await prisma.product.findUnique({ where: { handle }, select: { id: true } });
    if (!clash) return handle;
    handle = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

function optionLabel(options: Record<string, string>): string {
  const parts = Object.values(options).filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Default';
}

/** Fetch + normalize + price, without writing anything. */
export async function previewImport(
  rawUrl: string,
  overrideRules?: Partial<PricingRules>
): Promise<PreviewResult> {
  let url = rawUrl.trim();

  let parsed = parseSupplierUrl(url);
  if (!parsed) throw new Error('That does not look like a URL. Paste the full supplier product link.');

  if (parsed.needsResolution) {
    url = await resolveShortLink(parsed.canonicalUrl);
    parsed = parseSupplierUrl(url) ?? parsed;
  }

  const adapter = parsed.platform === 'OTHER' ? genericAdapter : adapterFor(parsed.platform);
  const product = await adapter.fetchProduct(parsed);

  const settings = await getStoreSettings();
  const storedRules = await getPricingRules();
  const rules: PricingRules = { ...storedRules, ...overrideRules };

  // Shipping the supplier charges us is part of landed cost, not a separate
  // line — forgetting it is the classic "why is my margin negative" bug.
  const perUnitShipping = product.shippingCostMinor;

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
    pricing.push({
      optionLabel: optionLabel(variant.options),
      sourceCostMinor: variant.costMinor,
      landedCostMinor: baseMinor,
      priceMinor: result.priceMinor,
      compareAtMinor: result.compareAtMinor,
      profitMinor: result.profitMinor,
      marginPct: result.marginPct,
      warnings: converted
        ? result.warnings
        : [
            ...result.warnings,
            `No exchange rate for ${product.currency} — landed cost could not be calculated. Add a rate in Settings, or enter the cost by hand.`,
          ],
    });
  }

  let alreadyImported: PreviewResult['alreadyImported'] = null;
  if (parsed.externalId) {
    const existing = await prisma.supplierProduct.findUnique({
      where: {
        platform_externalId: {
          platform: parsed.platform as Platform as never,
          externalId: parsed.externalId,
        },
      },
      include: { product: { select: { id: true, handle: true, title: true } } },
    });
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
  };
}

export interface CommitImportInput {
  preview: PreviewResult;
  /** Admin's edits applied on top of the scraped data. */
  title?: string;
  descriptionHtml?: string;
  handle?: string;
  productType?: string;
  tags?: string[];
  collectionIds?: string[];
  supplierName?: string;
  /** Explicit per-variant price overrides, keyed by variant index. */
  priceOverrides?: Record<number, number>;
  /** Explicit per-variant landed-cost overrides (for manual imports). */
  costOverrides?: Record<number, number>;
}

export interface CommitResult {
  productId: string;
  handle: string;
  variantCount: number;
  warnings: string[];
}

/** Persist a previewed import as a DRAFT product. */
export async function commitImport(input: CommitImportInput): Promise<CommitResult> {
  const { preview } = input;
  const p = preview.product;
  const warnings: string[] = [];

  /*
   * Cleaned here rather than at extraction, so the raw supplier title stays
   * visible in the capture list while sourcing — that is where it is evidence,
   * and where a keyword-stuffed original sometimes reveals what a product
   * really is. It is only on the way into the catalogue that it becomes copy.
   *
   * A title typed by hand in the import form is cleaned too: the same length
   * limit applies to the card either way, and it still only ever removes.
   */
  const title = cleanProductTitle(input.title ?? p.title);
  if (!title) throw new Error('A product title is required.');

  const handle = await uniqueHandle(input.handle ? slugify(input.handle) : slugify(title));

  /*
   * Two different things share this name. The Supplier record is internal and
   * wants the platform in it, because that is what we need to reorder from.
   * Product.vendor is customer-facing and must not read "ALIEXPRESS supplier" —
   * that tells a shopper where we buy rather than who makes it.
   */
  const supplierName =
    input.supplierName?.trim() || p.supplierName?.trim() || `${p.platform} supplier`;
  const customerFacingVendor = normaliseVendor(supplierName);

  /*
   * File it now, from the title. Doing this by hand was skipped on every import
   * so far, which is why the homepage department tiles all read zero. A product
   * that matches nothing is left uncategorised on purpose — a hair clipper in
   * Pet Supplies is worse than one in no collection, because nobody goes
   * looking for the mistake.
   */
  const categoryHandle = categorise(title, input.productType);
  const collection = categoryHandle
    ? await prisma.collection.findUnique({ where: { handle: categoryHandle }, select: { id: true } })
    : null;

  const supplier = await findOrCreateSupplier(supplierName, p.platform, p.supplierStoreUrl);

  const created = await prisma.product.create({
    data: {
      handle,
      title,
      descriptionHtml: input.descriptionHtml ?? p.descriptionHtml,
      status: 'DRAFT', // never auto-publish an import
      productType: input.productType,
      tags: input.tags ?? [],
      vendor: customerFacingVendor,
      ...(collection ? { collections: { create: { collectionId: collection.id } } } : {}),
      images: {
        create: p.images.map((url, i) => ({ url, position: i, alt: title })),
      },
      variants: {
        // Cleaned as a set, so the collision guard can see every label at once.
        create: cleanOptionLabels(
          p.variants.map((v, i) => preview.pricing[i]?.optionLabel ?? optionLabel(v.options))
        ).map((label, i) => {
          const v = p.variants[i];
          const priced = preview.pricing[i];
          const costMinor = input.costOverrides?.[i] ?? priced?.landedCostMinor ?? 0;
          const priceMinor = input.priceOverrides?.[i] ?? priced?.priceMinor ?? 0;
          if (priceMinor <= costMinor) {
            warnings.push(
              // "Variant \"Default\"" reads as a bug; a single-variant product
              // has no option to name.
              `${
                variantLabel(priced?.optionLabel) ?? 'This product'
              } is priced at or below its landed cost — it is a guaranteed loss and was left in draft.`
            );
          }
          return {
            title: label,
            position: i,
            optionValues: v.options as never,
            priceMinor,
            compareAtMinor: priced?.compareAtMinor ?? null,
            costMinor,
            inventory: null,
            imageUrl: v.imageUrl ?? p.images[0],
            supplierVariantId: v.externalVariantId,
            supplierSku: v.supplierSku,
            sourceCostMinor: v.costMinor,
            sourceCostCurrency: p.currency,
          };
        }),
      },
      source: {
        create: {
          supplierId: supplier.id,
          platform: p.platform as never,
          externalId: p.externalId || `${p.platform}-${Date.now()}`,
          sourceUrl: p.sourceUrl,
          sourceCurrency: p.currency,
          sourcePriceMinor: p.costMinor,
          shippingCostMinor: p.shippingCostMinor,
          importFxRate: preview.fxRateUsed,
          /*
           * Fold the supplier's rating into the stored payload.
           *
           * It is captured but was never persisted, so the one number that
           * says whether a listing is worth stocking died at the import step.
           * Kept in `raw` rather than a new column because migrations cannot
           * be run on this host — see the note in src/lib/db.ts.
           *
           * SOURCING EVIDENCE ONLY. This is the supplier's rating for the
           * supplier's listing; it is shown in admin and must never appear on
           * the storefront, where it would read as a review of our shop.
           */
          raw: {
            ...(p.raw && typeof p.raw === 'object' ? (p.raw as Record<string, unknown>) : {}),
            supplierRating: p.rating ?? null,
            supplierReviewCount: p.reviewCount ?? null,
          } as never,
          lastCheckedAt: new Date(),
        },
      },
    },
    include: { variants: { select: { id: true } } },
  });

  if (input.collectionIds?.length) {
    await prisma.collectionProduct.createMany({
      data: input.collectionIds.map((collectionId, i) => ({
        collectionId,
        productId: created.id,
        position: i,
      })),
      skipDuplicates: true,
    });
  }

  /*
   * Close the loop back to the capture this product came from.
   *
   * SupplierCapture.importedProductId existed from the start but NOTHING ever
   * wrote it, so the import queue showed every capture as un-imported forever —
   * including products long since live and selling. previewFromCapture already
   * puts captureId on the preview and the client posts that preview straight
   * back here, so the link was available the whole time and simply unused.
   *
   * Deliberately not fatal: the product is created and the customer-facing work
   * is done. Failing the whole import because a bookkeeping field would not
   * update would be the wrong trade.
   */
  const captureId = (preview as { captureId?: string }).captureId;
  if (captureId) {
    await prisma.supplierCapture
      .update({
        where: { id: captureId },
        data: { importedProductId: created.id, importedAt: new Date() },
      })
      .catch(() => {
        warnings.push('Product created, but the capture could not be marked as imported.');
      });
  }

  return {
    productId: created.id,
    handle: created.handle,
    variantCount: created.variants.length,
    warnings: [...warnings, ...p.warnings],
  };
}

/**
 * Suppliers are deduped by (name, platform) so every link from the same store
 * groups under one supplier — which is what makes it possible to batch a day's
 * orders into a single placement per supplier later.
 */
async function findOrCreateSupplier(name: string, platform: string, storeUrl?: string) {
  const existing = await prisma.supplier.findFirst({
    where: { name, platform: platform as never },
  });
  if (existing) {
    if (storeUrl && !existing.storeUrl) {
      return prisma.supplier.update({ where: { id: existing.id }, data: { storeUrl } });
    }
    return existing;
  }
  return prisma.supplier.create({
    data: { name, platform: platform as never, storeUrl },
  });
}
