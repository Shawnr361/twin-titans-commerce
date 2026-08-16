import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

/**
 * Product search.
 *
 * Implemented with LIKE across the fields a shopper actually types into a
 * search box. Note there is no `mode: 'insensitive'` — that option is
 * PostgreSQL-only and throws on MySQL. MySQL's default utf8mb4_unicode_ci
 * collation is already case-insensitive, so `contains` does the right thing.
 *
 * This is deliberately a thin, replaceable layer: the route returns card data
 * and nothing else knows how the matching happened, so swapping in Algolia,
 * Meilisearch or MySQL full-text later is a change to this file alone.
 *
 * An empty query returns newest products, so opening search never shows a
 * blank panel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  const settings = await getStoreSettings();

  try {
    const where =
      q.length === 0
        ? { status: 'ACTIVE' as const }
        : {
            status: 'ACTIVE' as const,
            OR: [
              { title: { contains: q } },
              { vendor: { contains: q } },
              { productType: { contains: q } },
              { handle: { contains: q.replace(/\s+/g, '-') } },
              { variants: { some: { sku: { contains: q } } } },
            ],
          };

    const products = await prisma.product.findMany({
      where,
      orderBy: q.length === 0 ? { createdAt: 'desc' } : { title: 'asc' },
      take: 8,
      select: CARD_SELECT,
    });

    return NextResponse.json({
      query: q,
      count: products.length,
      results: products.map((p) => toCard(p, settings.baseCurrency)),
    });
  } catch {
    // Search failing must never take the page down with it.
    return NextResponse.json({ query: q, count: 0, results: [], degraded: true });
  }
}
