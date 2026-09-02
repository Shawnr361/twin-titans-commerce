import { call } from './aliexpress-api';
import type { CapturedProduct } from './capture';

/**
 * Build a capture from the AliExpress API instead of from a browser.
 *
 * WHY THIS IS BETTER THAN SCRAPING
 * --------------------------------
 * The bookmarklet exists because a server fetch of an AliExpress page returns
 * an anti-bot shell — no prices, no SKUs. That reasoning was sound for the
 * PUBLIC page. It does not apply to the authorised API, which hands over the
 * same data as structured JSON.
 *
 * So this needs nothing from the page: give it a product id and it returns
 * everything. No HTML parsing to break when AliExpress redesigns, no
 * Content-Security-Policy to fight, and prices and SKUs come from the source of
 * truth rather than from whatever had finished rendering. The entire class of
 * bug this session spent its time on — a missing SKU, a mislabelled option —
 * cannot arise here.
 *
 * IT PRODUCES A CapturedProduct, DELIBERATELY
 * -------------------------------------------
 * Not a second import path. The output is the same shape the bookmarklet posts,
 * so pricing, the preview, the quality gate, the importer and the capture list
 * all work on it unchanged. A parallel path would drift from the one that
 * already works.
 */

type Row = Record<string, unknown>;

/** First present value among several possible field spellings. */
function pick(row: Row | null, ...names: string[]): unknown {
  if (!row) return undefined;
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
  }
  return undefined;
}

const str = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
};

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/**
 * Find the first object anywhere in the reply that has all of these keys.
 *
 * The gateway wraps payloads differently per method and nests DTOs under names
 * like `ae_item_sku_info_d_t_o`. Searching by shape rather than by path means a
 * changed wrapper does not silently return nothing.
 */
function findByKeys(body: unknown, keys: string[]): Row | null {
  let found: Row | null = null;
  const walk = (v: unknown) => {
    if (found || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const row = v as Row;
    if (keys.every((k) => row[k] !== undefined)) {
      found = row;
      return;
    }
    Object.values(row).forEach(walk);
  };
  walk(body);
  return found;
}

/** Every object anywhere in the reply carrying a sku id. */
function findSkuRows(body: unknown): Row[] {
  const rows: Row[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const row = v as Row;
    if (pick(row, 'sku_id', 'skuId') !== undefined) rows.push(row);
    Object.values(row).forEach(walk);
  };
  walk(body);
  return rows;
}

/** { Colour: "White", Size: "XL" } from a SKU's property list. */
function optionsOf(row: Row): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const p = v as Row;
    const name = str(pick(p, 'sku_property_name', 'skuPropertyName'));
    const value = str(
      pick(p, 'property_value_definition_name', 'propertyValueDefinitionName', 'sku_property_value', 'skuPropertyValue')
    );
    if (name && value) out[name] = value;
    Object.values(p).forEach(walk);
  };
  walk(pick(row, 'ae_sku_property_dtos', 'aeSkuPropertyDtos') ?? {});

  /*
   * Fall back to sku_attr when the property list is absent: "14:365458#Red"
   * carries the readable value after the '#'. Named generically because the
   * attribute id is not a name a shopper would recognise.
   */
  if (Object.keys(out).length === 0) {
    const attr = str(pick(row, 'sku_attr', 'skuAttr'));
    if (attr) {
      attr
        .split(';')
        .map((part) => part.split('#')[1])
        .filter(Boolean)
        .forEach((value, i) => {
          out[i === 0 ? 'Option' : `Option ${i + 1}`] = decodeURIComponent(value).trim();
        });
    }
  }
  return out;
}

function imagesFrom(body: unknown): string[] {
  const media = findByKeys(body, ['image_urls']) ?? findByKeys(body, ['imageUrls']);
  const raw = str(pick(media, 'image_urls', 'imageUrls')) ?? '';
  return raw
    .split(/[;,]/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'))
    .slice(0, 12);
}


/**
 * Product videos.
 *
 * The API rarely hands over a playable URL. What it gives is a media id and the
 * seller's member id, from which AliExpress's own player URL is assembled — a
 * pattern, not a documented field, which is why every candidate is CHECKED
 * before it is kept. A dead video in the gallery is worse than no video: it
 * renders as a broken player on the product page, and nobody notices until a
 * customer does.
 */
function videoCandidates(body: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const row = v as Row;

    // A real URL, if the reply happens to carry one.
    const direct = str(pick(row, 'video_url', 'videoUrl', 'media_url', 'mediaUrl', 'url'));
    if (direct && /^https?:\/\//.test(direct) && /\.(mp4|m3u8)/i.test(direct)) out.push(direct);

    const mediaId = str(pick(row, 'media_id', 'mediaId'));
    const memberId = str(pick(row, 'ali_member_id', 'aliMemberId'));
    if (mediaId && memberId) {
      out.push(
        `https://video.aliexpress-media.com/play/u/ae_sg_item/${memberId}/p/1/e/6/t/10301/${mediaId}.mp4`
      );
    }
    Object.values(row).forEach(walk);
  };
  walk(body);
  return [...new Set(out)];
}

/** Does this URL actually serve something? One byte is enough to know. */
async function playable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { range: 'bytes=0-0' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

async function verifiedVideos(body: unknown): Promise<string[]> {
  const candidates = videoCandidates(body).slice(0, 4);
  if (candidates.length === 0) return [];
  const checked = await Promise.all(
    candidates.map(async (url) => ((await playable(url)) ? url : null))
  );
  return checked.filter((u): u is string => Boolean(u));
}

export interface ApiCaptureResult {
  capture: CapturedProduct | null;
  problems: string[];
}

export async function captureFromApi(
  productId: string,
  sourceUrl: string,
  currency = 'USD'
): Promise<ApiCaptureResult> {
  const problems: string[] = [];

  const res = await call('aliexpress.ds.product.get', {
    product_id: productId,
    ship_to_country: 'NG',
    target_currency: currency,
    target_language: 'en',
  });

  const base =
    findByKeys(res.body, ['subject']) ??
    findByKeys(res.body, ['product_title']) ??
    findByKeys(res.body, ['productTitle']);

  const title = str(pick(base, 'subject', 'product_title', 'productTitle'));
  if (!title) {
    return {
      capture: null,
      problems: [
        `AliExpress returned no title for ${productId}. Raw reply began: ${JSON.stringify(res.body).slice(0, 300)}`,
      ],
    };
  }

  const skuRows = findSkuRows(res.body);
  if (skuRows.length === 0) problems.push('No SKUs came back, so there is nothing to price.');

  const variants = skuRows.map((row) => {
    /*
     * `price` is the cost basis for reordering, so it must be the REGULAR
     * price, not the countdown-sale figure — these listings are discounted
     * almost permanently and costing at the promotional number prices the
     * catalogue against something that expires.
     */
    const list = num(pick(row, 'sku_price', 'skuPrice', 'original_price'));
    const sale = num(pick(row, 'offer_sale_price', 'sku_sale_price', 'offerSalePrice', 'sale_price'));
    const price = list ?? sale ?? 0;
    return {
      skuId: str(pick(row, 'sku_id', 'skuId')),
      options: optionsOf(row),
      price,
      ...(sale !== undefined && sale < price ? { promoPrice: sale } : {}),
      stock: num(pick(row, 'sku_available_stock', 'skuAvailableStock', 'available_stock')),
      imageUrl: str(pick(row, 'sku_image', 'skuImage')),
    };
  });

  const store = findByKeys(res.body, ['store_name']) ?? findByKeys(res.body, ['storeName']);
  const images = imagesFrom(res.body);
  if (images.length === 0) problems.push('No images came back.');

  const videos = await verifiedVideos(res.body);
  const candidateCount = videoCandidates(res.body).length;
  if (candidateCount > 0 && videos.length === 0) {
    problems.push(
      `${candidateCount} video(s) were listed but none played back, so none were kept.`
    );
  }

  const capture: CapturedProduct = {
    sourceUrl,
    platform: 'ALIEXPRESS',
    externalId: productId,
    title,
    descriptionHtml: str(pick(base, 'detail', 'description')) ?? '',
    currency,
    images,
    videos,
    variants,
    supplierName: str(pick(store, 'store_name', 'storeName')),
    supplierStoreUrl: str(pick(store, 'store_url', 'storeUrl')),
    rating: num(pick(base, 'avg_evaluation_rating', 'evaluation_rating')),
    reviewCount: num(pick(base, 'evaluation_count', 'total_evaluation')),
    ordersCount: num(pick(base, 'sales_count', 'total_sales')),
    reviews: [],
  } as CapturedProduct;

  return { capture, problems };
}
