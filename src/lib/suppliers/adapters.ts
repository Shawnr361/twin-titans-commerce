import { toMinor } from '../money';
import { extractBase, extractInlineJson, singleVariant, upgradeImage } from './extract';
import { fetchListingHtml } from './fetch';
import { parseSupplierUrl } from './parse';
import type {
  NormalizedProduct,
  NormalizedVariant,
  ParsedSupplierUrl,
  SupplierAdapter,
} from './types';

/** Wrap the shared extraction into a NormalizedProduct shell. */
async function baseFetch(
  parsed: ParsedSupplierUrl,
  enrich?: (html: string, product: NormalizedProduct) => void
): Promise<NormalizedProduct> {
  const res = await fetchListingHtml(parsed.canonicalUrl);

  if (!res.ok) {
    // Do NOT fabricate a product. Hand back an empty shell flagged `manual` so
    // the admin UI shows the paste-it-yourself form with the real reason.
    return {
      platform: parsed.platform,
      externalId: parsed.externalId,
      sourceUrl: parsed.canonicalUrl,
      title: '',
      descriptionHtml: '',
      images: [],
      optionNames: [],
      currency: 'USD',
      costMinor: 0,
      shippingCostMinor: 0,
      variants: [],
      provenance: 'manual',
      warnings: [
        res.error ?? 'Could not read the supplier listing.',
        'Enter the product details manually, or set SCRAPER_ENDPOINT to route through a scraping gateway.',
      ],
    };
  }

  const base = extractBase(res.html, parsed.canonicalUrl);
  const product: NormalizedProduct = {
    platform: parsed.platform,
    externalId: parsed.externalId,
    sourceUrl: parsed.canonicalUrl,
    title: base.title,
    descriptionHtml: base.descriptionHtml,
    images: base.images,
    optionNames: [],
    currency: base.currency,
    costMinor: base.costMinor,
    shippingCostMinor: 0,
    variants: singleVariant(base.costMinor, base.images[0]),
    supplierName: base.supplierName,
    rating: base.rating,
    reviewCount: base.reviewCount,
    provenance: 'page',
    warnings: [...base.warnings],
  };

  try {
    enrich?.(res.html, product);
  } catch (err) {
    product.warnings.push(
      `Variant matrix could not be read (${err instanceof Error ? err.message : 'parse error'}); imported as a single variant.`
    );
  }

  if (product.variants.length === 0) {
    product.variants = singleVariant(product.costMinor, product.images[0]);
  }
  return product;
}

// ---------------------------------------------------------------------------
// AliExpress
// ---------------------------------------------------------------------------

interface AeSkuProperty {
  skuPropertyName?: string;
  skuPropertyValues?: {
    propertyValueId?: number;
    propertyValueDisplayName?: string;
    propertyValueName?: string;
    skuPropertyImagePath?: string;
  }[];
}

function enrichAliExpress(html: string, product: NormalizedProduct): void {
  // AliExpress ships the whole PDP state in one of these globals depending on
  // which page version you get served.
  const data =
    (extractInlineJson(html, 'window.runParams') as Record<string, any> | null) ??
    (extractInlineJson(html, '_d_c_.DCData') as Record<string, any> | null) ??
    (extractInlineJson(html, 'window._dida_config_._init_data_') as Record<string, any> | null);

  const root = (data?.data ?? data) as Record<string, any> | undefined;
  if (!root) return;

  const skuModule = root.skuModule ?? root.SKU_MODULE ?? root.priceComponent;
  const titleModule = root.titleModule ?? root.TITLE_MODULE;
  const imageModule = root.imageModule ?? root.IMAGE_MODULE;
  const storeModule = root.storeModule ?? root.SHOP_CARD;
  const shippingModule = root.shippingModule ?? root.WEB_SHIPPING;

  if (titleModule?.subject) product.title = String(titleModule.subject);
  if (titleModule?.formatTradeCount) {
    const n = parseInt(String(titleModule.formatTradeCount).replace(/\D/g, ''), 10);
    if (Number.isFinite(n)) product.ordersCount = n;
  }
  if (titleModule?.feedbackRating?.averageStar) {
    product.rating = Number(titleModule.feedbackRating.averageStar);
  }
  if (titleModule?.feedbackRating?.totalValidNum) {
    product.reviewCount = Number(titleModule.feedbackRating.totalValidNum);
  }

  if (Array.isArray(imageModule?.imagePathList)) {
    const imgs = imageModule.imagePathList.map((i: string) => upgradeImage(i)).filter(Boolean);
    if (imgs.length) product.images = imgs.slice(0, 12);
  }

  if (storeModule?.storeName) product.supplierName = String(storeModule.storeName);
  if (storeModule?.storeURL) {
    product.supplierStoreUrl = String(storeModule.storeURL).startsWith('http')
      ? storeModule.storeURL
      : `https:${storeModule.storeURL}`;
  }

  const freight = shippingModule?.generalFreightInfo?.originalLayoutResultList?.[0];
  const shipAmount = freight?.bizData?.displayAmount ?? freight?.bizData?.freightAmount?.value;
  if (shipAmount != null) {
    product.shippingCostMinor = toMinor(Number(shipAmount), product.currency);
  }
  if (freight?.bizData?.shipFrom) product.shipsFrom = String(freight.bizData.shipFrom);

  // Option names, in the supplier's own order.
  const props: AeSkuProperty[] = skuModule?.productSKUPropertyList ?? [];
  const propNameById = new Map<number, { prop: string; value: string; image?: string }>();
  for (const p of props) {
    const name = p.skuPropertyName?.trim();
    if (!name) continue;
    product.optionNames.push(name);
    for (const v of p.skuPropertyValues ?? []) {
      if (v.propertyValueId == null) continue;
      propNameById.set(v.propertyValueId, {
        prop: name,
        value: (v.propertyValueDisplayName || v.propertyValueName || '').trim(),
        image: v.skuPropertyImagePath ? upgradeImage(v.skuPropertyImagePath) : undefined,
      });
    }
  }

  const priceList = skuModule?.skuPriceList ?? [];
  if (!Array.isArray(priceList) || priceList.length === 0) return;

  const variants: NormalizedVariant[] = [];
  let cheapest = Number.MAX_SAFE_INTEGER;

  for (const sku of priceList) {
    const priceInfo = sku.skuVal ?? {};
    const amount =
      priceInfo.skuActivityAmount?.value ??
      priceInfo.skuAmount?.value ??
      priceInfo.actSkuMultiCurrencyCalPrice ??
      priceInfo.skuMultiCurrencyCalPrice;
    if (amount == null) continue;

    const currency =
      priceInfo.skuActivityAmount?.currency ?? priceInfo.skuAmount?.currency ?? product.currency;
    product.currency = String(currency).toUpperCase();

    const costMinor = toMinor(Number(amount), product.currency);
    if (costMinor > 0 && costMinor < cheapest) cheapest = costMinor;

    const options: Record<string, string> = {};
    let imageUrl: string | undefined;
    const ids = String(sku.skuPropIds ?? '')
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter(Number.isFinite);
    for (const id of ids) {
      const hit = propNameById.get(id);
      if (!hit) continue;
      options[hit.prop] = hit.value;
      if (!imageUrl && hit.image) imageUrl = hit.image;
    }

    variants.push({
      externalVariantId: String(sku.skuId ?? sku.skuIdStr ?? ''),
      supplierSku: sku.skuAttr ? String(sku.skuAttr) : undefined,
      options,
      costMinor,
      imageUrl: imageUrl ?? product.images[0],
      stock: priceInfo.availQuantity != null ? Number(priceInfo.availQuantity) : null,
    });
  }

  if (variants.length) {
    product.variants = variants;
    if (cheapest !== Number.MAX_SAFE_INTEGER) product.costMinor = cheapest;
  }
}

export const aliexpressAdapter: SupplierAdapter = {
  platform: 'ALIEXPRESS',
  label: 'AliExpress',
  matches: (url) => parseSupplierUrl(url)?.platform === 'ALIEXPRESS',
  parse: (url) => {
    const p = parseSupplierUrl(url);
    return p?.platform === 'ALIEXPRESS' ? p : null;
  },
  fetchProduct: (parsed) => baseFetch(parsed, enrichAliExpress),
};

// ---------------------------------------------------------------------------
// Alibaba — B2B. Prices are tiered by quantity and MOQ usually > 1.
// ---------------------------------------------------------------------------

function enrichAlibaba(html: string, product: NormalizedProduct): void {
  const data =
    (extractInlineJson(html, 'window.detailData') as Record<string, any> | null) ??
    (extractInlineJson(html, 'window.__INIT_DATA__') as Record<string, any> | null) ??
    (extractInlineJson(html, 'window.__page_config__') as Record<string, any> | null);

  const root = (data?.globalData ?? data?.data ?? data) as Record<string, any> | undefined;

  const ladder =
    root?.product?.productPrice?.ladderPrices ??
    root?.offerPrice?.ladderPrices ??
    root?.priceModule?.ladderPrices;

  if (Array.isArray(ladder) && ladder.length) {
    // Cheapest tier is the volume price; the ENTRY tier is what we would
    // actually pay at dropship quantities, so take the first (lowest MOQ) tier.
    const entry = ladder[0];
    const price = entry?.price ?? entry?.dollarPrice ?? entry?.value;
    if (price != null) {
      product.costMinor = toMinor(Number(String(price).replace(/[^0-9.]/g, '')), product.currency);
    }
    const moq = entry?.min ?? entry?.startQuantity;
    if (moq && Number(moq) > 1) {
      product.warnings.push(
        `Alibaba MOQ is ${moq} units at this tier — this supplier cannot ship single dropship orders unless you pre-buy stock.`
      );
    }
    product.warnings.push(
      `Alibaba pricing is tiered (${ladder.length} tiers). The entry tier was used; bulk tiers are cheaper.`
    );
  }

  const company = root?.companyModule ?? root?.supplier;
  if (company?.companyName) product.supplierName = String(company.companyName);
  if (company?.companyDetailUrl) product.supplierStoreUrl = String(company.companyDetailUrl);

  product.warnings.push(
    'Alibaba is a wholesale/B2B marketplace — confirm the supplier will ship one unit per order, direct to your customer, before selling.'
  );
}

export const alibabaAdapter: SupplierAdapter = {
  platform: 'ALIBABA',
  label: 'Alibaba',
  matches: (url) => parseSupplierUrl(url)?.platform === 'ALIBABA',
  parse: (url) => {
    const p = parseSupplierUrl(url);
    return p?.platform === 'ALIBABA' ? p : null;
  },
  fetchProduct: (parsed) => baseFetch(parsed, enrichAlibaba),
};

// ---------------------------------------------------------------------------
// 1688 — domestic-China wholesale. CNY, Chinese-language, needs an agent.
// ---------------------------------------------------------------------------

function enrich1688(html: string, product: NormalizedProduct): void {
  const data =
    (extractInlineJson(html, 'window.__INIT_DATA') as Record<string, any> | null) ??
    (extractInlineJson(html, 'iDetailData') as Record<string, any> | null);

  const root = (data?.data ?? data) as Record<string, any> | undefined;
  product.currency = 'CNY';

  const priceModel = root?.orderParamModel ?? root?.skuModel ?? root?.priceModel;
  const ladder = priceModel?.orderParamItem?.skuRangePrices ?? priceModel?.rangePrices;
  if (Array.isArray(ladder) && ladder.length) {
    const entry = ladder[0];
    const price = entry?.price ?? entry?.beginAmount;
    if (price != null) product.costMinor = toMinor(Number(price), 'CNY');
  }

  const skuMap = priceModel?.orderParamItem?.skuMap ?? priceModel?.skuMap;
  if (skuMap && typeof skuMap === 'object') {
    const variants: NormalizedVariant[] = [];
    for (const [key, val] of Object.entries(skuMap as Record<string, any>)) {
      const parts = String(key).split('&gt;').filter(Boolean);
      const options: Record<string, string> = {};
      parts.forEach((part, i) => {
        options[product.optionNames[i] ?? `Option ${i + 1}`] = part.trim();
      });
      variants.push({
        externalVariantId: val?.skuId ? String(val.skuId) : undefined,
        options,
        costMinor: val?.price != null ? toMinor(Number(val.price), 'CNY') : product.costMinor,
        stock: val?.canBookCount != null ? Number(val.canBookCount) : null,
      });
    }
    if (variants.length) product.variants = variants;
  }

  product.warnings.push(
    '1688 sells domestically inside China and does not ship internationally — you need a sourcing agent or freight forwarder to fulfil these orders.'
  );
  product.warnings.push('Listing text is Chinese — the title and description need rewriting before publishing.');
}

export const c1688Adapter: SupplierAdapter = {
  platform: 'C1688',
  label: '1688',
  matches: (url) => parseSupplierUrl(url)?.platform === 'C1688',
  parse: (url) => {
    const p = parseSupplierUrl(url);
    return p?.platform === 'C1688' ? p : null;
  },
  fetchProduct: (parsed) => baseFetch(parsed, enrich1688),
};

// ---------------------------------------------------------------------------
// Fallback — any other URL. JSON-LD/OG only.
// ---------------------------------------------------------------------------

export const genericAdapter: SupplierAdapter = {
  platform: 'OTHER',
  label: 'Other supplier',
  matches: () => true,
  parse: (url) => parseSupplierUrl(url),
  fetchProduct: (parsed) => baseFetch(parsed),
};

export const ADAPTERS: SupplierAdapter[] = [
  aliexpressAdapter,
  alibabaAdapter,
  c1688Adapter,
  genericAdapter,
];

export function adapterFor(platform: string): SupplierAdapter {
  return ADAPTERS.find((a) => a.platform === platform) ?? genericAdapter;
}
