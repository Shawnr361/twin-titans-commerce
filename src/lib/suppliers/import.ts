import { prisma } from '../db';
import { sourceCostToBase } from '../fx';
import { computePrice, type PricingRules } from '../pricing';
import { getPricingRules, getStoreSettings } from '../settings';
import { adapterFor, genericAdapter } from './adapters';
import { parseSupplierUrl, resolveShortLink } from './parse';
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

  const title = (input.title ?? p.title).trim();
  if (!title) throw new Error('A product title is required.');

  const handle = await uniqueHandle(input.handle ? slugify(input.handle) : slugify(title));

  const supplierName =
    input.supplierName?.trim() || p.supplierName?.trim() || `${p.platform} supplier`;

  const supplier = await findOrCreateSupplier(supplierName, p.platform, p.supplierStoreUrl);

  const created = await prisma.product.create({
    data: {
      handle,
      title,
      descriptionHtml: input.descriptionHtml ?? p.descriptionHtml,
      status: 'DRAFT', // never auto-publish an import
      productType: input.productType,
      tags: input.tags ?? [],
      vendor: supplierName,
      images: {
        create: p.images.map((url, i) => ({ url, position: i, alt: title })),
      },
      variants: {
        create: p.variants.map((v, i) => {
          const priced = preview.pricing[i];
          const costMinor = input.costOverrides?.[i] ?? priced?.landedCostMinor ?? 0;
          const priceMinor = input.priceOverrides?.[i] ?? priced?.priceMinor ?? 0;
          if (priceMinor <= costMinor) {
            warnings.push(
              `Variant "${priced?.optionLabel ?? i}" is priced at or below its landed cost — it is a guaranteed loss and was left in draft.`
            );
          }
          return {
            title: priced?.optionLabel ?? optionLabel(v.options),
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
          raw: (p.raw ?? null) as never,
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
