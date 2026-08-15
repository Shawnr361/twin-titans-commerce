import * as cheerio from 'cheerio';
import { toMinor } from '../money';
import type { NormalizedProduct, NormalizedVariant, ParsedSupplierUrl } from './types';

/**
 * Shared extraction that works across all three marketplaces, because they all
 * ship the same three things even when their internal JSON differs:
 *   1. JSON-LD Product markup (best — structured, includes offers)
 *   2. OpenGraph tags (title/image/price)
 *   3. An embedded state blob (platform-specific, handled by each adapter)
 *
 * Each adapter runs this first, then layers its own parsing on top.
 */

export interface ExtractedBase {
  title: string;
  descriptionHtml: string;
  images: string[];
  currency: string;
  costMinor: number;
  rating?: number;
  reviewCount?: number;
  supplierName?: string;
  warnings: string[];
}

function absolutise(src: string, base: string): string {
  if (!src) return '';
  if (src.startsWith('//')) return 'https:' + src;
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, base).toString();
  } catch {
    return '';
  }
}

/** Alibaba/AliExpress CDNs append size suffixes; strip to get the full-size original. */
export function upgradeImage(url: string): string {
  return url
    .replace(/_\d+x\d+(q\d+)?(\.\w+)?\.(jpg|jpeg|png|webp)$/i, '')
    .replace(/\.(jpg|jpeg|png|webp)_\d+x\d+.*$/i, '.$1')
    .replace(/_\.webp$/i, '');
}

function collectJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === 'object') {
          out.push(item as Record<string, unknown>);
          const graph = (item as Record<string, unknown>)['@graph'];
          if (Array.isArray(graph)) {
            for (const g of graph) if (g && typeof g === 'object') out.push(g as Record<string, unknown>);
          }
        }
      }
    } catch {
      /* malformed JSON-LD is common; ignore it rather than failing the import */
    }
  });
  return out;
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

export function extractBase(html: string, sourceUrl: string): ExtractedBase {
  const $ = cheerio.load(html);
  const warnings: string[] = [];

  const jsonLd = collectJsonLd($);
  const product = jsonLd.find((n) => {
    const t = n['@type'];
    return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
  });

  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');

  const title =
    firstString(product?.name, ogTitle, $('title').first().text()) ?? 'Untitled supplier product';

  const description = firstString(product?.description, ogDesc) ?? '';

  // Offers can be a single object, an array, or an AggregateOffer.
  let currency = 'USD';
  let costMinor = 0;
  const offers = product?.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of offerList) {
    const cur = firstString(offer.priceCurrency);
    const price = firstString(offer.price, offer.lowPrice, (offer as Record<string, unknown>).lowprice);
    if (cur) currency = cur.toUpperCase();
    if (price) {
      const minor = toMinor(price, currency);
      if (minor > 0 && (costMinor === 0 || minor < costMinor)) costMinor = minor;
    }
  }

  if (costMinor === 0) {
    const metaPrice =
      $('meta[property="product:price:amount"]').attr('content') ??
      $('meta[property="og:price:amount"]').attr('content');
    const metaCur =
      $('meta[property="product:price:currency"]').attr('content') ??
      $('meta[property="og:price:currency"]').attr('content');
    if (metaCur) currency = metaCur.toUpperCase();
    if (metaPrice) costMinor = toMinor(metaPrice, currency);
  }

  if (costMinor === 0) {
    warnings.push('Could not read a price from the listing — enter the landed cost manually.');
  }

  // Images: JSON-LD, then OG, then any large product-looking <img>.
  const images = new Set<string>();
  const ldImage = product?.image;
  if (typeof ldImage === 'string') images.add(absolutise(ldImage, sourceUrl));
  else if (Array.isArray(ldImage)) {
    for (const i of ldImage) if (typeof i === 'string') images.add(absolutise(i, sourceUrl));
  }
  if (ogImage) images.add(absolutise(ogImage, sourceUrl));

  $('img').each((_, el) => {
    if (images.size >= 14) return;
    const src = $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('data-lazy-src') ?? '';
    if (!src) return;
    if (!/alicdn|aliexpress|alibaba|1688|cjdropshipping/i.test(src)) return;
    if (/logo|icon|sprite|avatar|placeholder|\.gif($|\?)/i.test(src)) return;
    const abs = absolutise(src, sourceUrl);
    if (abs) images.add(upgradeImage(abs));
  });

  const rating = product?.aggregateRating as Record<string, unknown> | undefined;

  return {
    title,
    descriptionHtml: description ? `<p>${escapeHtml(description)}</p>` : '',
    images: [...images].filter(Boolean).slice(0, 12),
    currency,
    costMinor,
    rating: rating?.ratingValue ? Number(rating.ratingValue) : undefined,
    reviewCount: rating?.reviewCount ? Number(rating.reviewCount) : undefined,
    supplierName: firstString(
      (product?.brand as Record<string, unknown> | undefined)?.name,
      product?.brand
    ),
    warnings,
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pull a JS object assigned in an inline <script>, e.g. `window.runParams = {...}`.
 * Brace-matches rather than regex-ing the whole blob, since these payloads are
 * enormous and contain nested braces inside strings.
 */
export function extractInlineJson(html: string, needle: string): unknown | null {
  const idx = html.indexOf(needle);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx + needle.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (inString) {
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Build the single default variant used when a listing exposes no SKU matrix. */
export function singleVariant(costMinor: number, imageUrl?: string): NormalizedVariant[] {
  return [{ options: {}, costMinor, imageUrl, stock: null }];
}

export function emptyProduct(
  parsed: ParsedSupplierUrl,
  warnings: string[]
): NormalizedProduct {
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
    warnings,
  };
}
