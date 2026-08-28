import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { siteOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * sitemap.xml.
 *
 * There was none, so /sitemap.xml returned the 404 page and Search Console had
 * nothing to read — which is what "we verified but now there's an error" was.
 *
 * Built from the database on request rather than at build time: products are
 * published from the admin without a redeploy, so a build-time sitemap would
 * freeze the catalogue as it stood at the last deploy.
 *
 * ONLY LIVE, INDEXABLE URLS
 * -------------------------
 * Draft products and unpublished pages are excluded. Listing a URL that answers
 * 404, or one marked noindex, is the fastest way to get a sitemap flagged in
 * Search Console — a sitemap is a claim that these pages are worth indexing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();

  const [products, collections, pages] = await Promise.all([
    prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        select: { handle: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      })
      .catch(() => []),
    prisma.collection
      .findMany({ select: { handle: true, updatedAt: true }, take: 500 })
      .catch(() => []),
    prisma.page
      .findMany({
        where: { published: true },
        select: { handle: true, updatedAt: true },
        take: 500,
      })
      .catch(() => []),
  ]);

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${base}/collections/all`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  return [
    ...staticEntries,
    ...collections.map((c) => ({
      url: `${base}/collections/${c.handle}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/products/${p.handle}`,
      lastModified: p.updatedAt ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...pages.map((p) => ({
      url: `${base}/pages/${p.handle}`,
      lastModified: p.updatedAt ?? now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ];
}
