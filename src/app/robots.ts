import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/seo';

/**
 * robots.txt.
 *
 * There was no robots.txt at all, so /robots.txt fell through to the 404 page —
 * which is rendered with `<meta name="robots" content="noindex">`. A crawler
 * asking for crawl rules was handed a noindex HTML document instead, and got no
 * pointer to a sitemap.
 *
 * Checkout, cart, admin and the customer's own order pages are excluded: they
 * are per-visitor, have nothing to rank for, and /orders/track and
 * /unsubscribe carry personal data in their query strings.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/cart', '/checkout', '/orders/', '/unsubscribe'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
