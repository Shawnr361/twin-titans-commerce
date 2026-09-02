import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { call } from '@/lib/suppliers/aliexpress-api';

export const dynamic = 'force-dynamic';

/**
 * Search AliExpress for products, through the API rather than the site.
 *
 * Product research has been done by driving a browser at aliexpress.com, which
 * fails in two ways that waste whole sessions: the site serves a stripped shell
 * to automation on some days and a CAPTCHA on others, and even on a good day the
 * numbers have to be read out of rendered cards. The authorised API answers the
 * same question as data.
 *
 * READ-ONLY, AND IT STORES NOTHING. Finding a product is not the same as
 * deciding to sell it, so this returns candidates and leaves the decision — and
 * the import — to a separate, deliberate step.
 *
 * Each result is marked with whether it is ALREADY IN THE CATALOGUE, matched on
 * the supplier's own product id. Re-adding something already on the shelf is
 * the most common research mistake, and the cheapest one to design out.
 */
const schema = z.object({
  q: z.string().min(2),
  /** Cheapest-first, dearest-first, or the supplier's own volume ranking. */
  sort: z.enum(['volume', 'priceAsc', 'priceDesc']).default('volume'),
  page: z.number().int().min(1).max(10).default(1),
  /*
   * Pass a sort value straight through, and see the raw shape of a result.
   *
   * The documented sort names for this method are not the ones the affiliate
   * API uses, and a wrong value is ACCEPTED SILENTLY — results come back
   * unsorted rather than as an error, which looked like "AliExpress has no
   * best-sellers" instead of "the parameter was ignored". Being able to try a
   * value and read the field names back settles it in one call instead of a
   * deploy per guess.
   */
  rawSort: z.string().optional(),
  debug: z.boolean().optional(),
  /** Ceiling in the supplier's currency, to skip units that cannot carry margin. */
  maxPrice: z.number().positive().optional(),
});

const SORT: Record<string, string> = {
  volume: 'LAST_VOLUME_DESC',
  priceAsc: 'SALE_PRICE_ASC',
  priceDesc: 'SALE_PRICE_DESC',
};

type Row = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.trim() || undefined : typeof v === 'number' ? String(v) : undefined;

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

function pick(row: Row, ...names: string[]): unknown {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n];
  return undefined;
}

/** Every object in the reply that looks like a product card. */
function productRows(body: unknown): Row[] {
  const rows: Row[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const row = v as Row;
    const id = pick(row, 'product_id', 'productId', 'item_id', 'itemId');
    const title = pick(row, 'product_title', 'productTitle', 'subject', 'title');
    if (id && title) rows.push(row);
    Object.values(row).forEach(walk);
  };
  walk(body);
  return rows;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give a search term.' }, { status: 400 });
  }
  const { q, sort, page, maxPrice, rawSort, debug } = parsed.data;

  const res = await call('aliexpress.ds.text.search', {
    keyWord: q,
    local: 'en_US',
    countryCode: 'NG',
    currency: 'USD',
    sortBy: rawSort ?? SORT[sort],
    pageSize: '20',
    pageIndex: String(page),
  });

  const rows = productRows(res.body);
  if (rows.length === 0) {
    return NextResponse.json({
      q,
      results: [],
      /*
       * Raw, deliberately. A method that is not subscribed on the account, or a
       * renamed field, both surface here — and only AliExpress's own wording
       * distinguishes them.
       */
      note: `No products parsed. Raw reply: ${JSON.stringify(res.body).slice(0, 600)}`,
    });
  }

  const seen = new Set<string>();
  const results = rows
    .map((row) => {
      const id = str(pick(row, 'product_id', 'productId', 'item_id', 'itemId')) ?? '';
      const sale = num(pick(row, 'target_sale_price', 'sale_price', 'app_sale_price'));
      const list = num(pick(row, 'target_original_price', 'original_price'));
      return {
        id,
        title: str(pick(row, 'product_title', 'productTitle', 'subject', 'title')) ?? '',
        salePrice: sale,
        listPrice: list,
        /*
         * The spread between promo and list is the honesty tell: AliExpress
         * discounts almost permanently, so a listing quoting 1-2% off is
         * quoting a real price, while one quoting 70% off is quoting something
         * that will not survive restocking. Costing at the promo is how a
         * catalogue ends up priced against a number that expires.
         */
        discountPct: sale && list && list > sale ? Math.round((1 - sale / list) * 100) : 0,
        rating: num(pick(row, 'evaluate_rate', 'evaluation_rate', 'avg_evaluation_rating')),
        orders: num(pick(row, 'lastest_volume', 'latest_volume', 'orders', 'sales_count')),
        image: str(pick(row, 'product_main_image_url', 'image_url', 'main_image_url')),
      };
    })
    .filter((r) => {
      if (!r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      if (maxPrice && r.listPrice && r.listPrice > maxPrice) return false;
      return true;
    });

  // Which of these are already on the shelf?
  const owned = await prisma.supplierProduct
    .findMany({
      where: { platform: 'ALIEXPRESS', externalId: { in: results.map((r) => r.id) } },
      select: { externalId: true, product: { select: { title: true } } },
    })
    .catch(() => []);
  const ownedBy = new Map(owned.map((o) => [o.externalId, o.product?.title ?? 'a product']));

  return NextResponse.json({
    q,
    sort: rawSort ?? sort,
    ...(debug ? { rawFields: Object.keys(rows[0] ?? {}), rawFirst: rows[0] } : {}),
    results: results.map((r) => ({
      ...r,
      alreadyInStore: ownedBy.get(r.id) ?? null,
    })),
  });
}
