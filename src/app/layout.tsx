import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk } from 'next/font/google';
import { prisma } from '@/lib/db';
import { CurrencyProvider } from '@/components/commerce/CurrencyContext';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ChatWidget } from '@/components/layout/ChatWidget';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { SearchOverlay } from '@/components/commerce/SearchOverlay';
import { getStoreSettings } from '@/lib/settings';
import { getTrackingSettings } from '@/lib/tracking';
import { Pixels } from '@/components/analytics/Pixels';
import './globals.css';

/**
 * Fraunces — a high-contrast variable serif with real character in its
 * italics. Chosen over Playfair (overexposed) and Inter (the default of every
 * generated site). `wonk` and `SOFT` are dialled to 0 so it reads as an
 * editorial masthead rather than a novelty face.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  // Variable font: the weight axis is continuous, so no `weight` list here.
  // SOFT and WONK stay available so the face can be tuned away from its
  // default quirkiness toward a straight editorial serif.
  axes: ['SOFT', 'WONK', 'opsz'],
});

/** Neutral grotesk for everything functional; disappears, which is the job. */
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hanken',
  weight: ['400', '500', '600'],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400';

  return {
    metadataBase: new URL(base),
    title: {
      default: `${settings.storeName} — ${settings.tagline}`,
      template: `%s — ${settings.storeName}`,
    },
    description: settings.tagline,
    applicationName: settings.storeName,
    openGraph: {
      type: 'website',
      siteName: settings.storeName,
      title: settings.storeName,
      description: settings.tagline,
      locale: 'en_NG',
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    alternates: { canonical: '/' },
    /*
     * Google Search Console ownership for twintitansemporium.store.
     *
     * The token was issued in the DNS TXT form (google-site-verification=…),
     * which is what a Domain property requires — so the TXT record in DNS is
     * what actually proves ownership. This meta tag carries the same token for
     * a URL-prefix property, and costs nothing if unused.
     *
     * It lives in code rather than as a public/ HTML file because public/ is not
     * part of the deployed artifact on this host; a verification file there
     * would 404 in production.
     */
    verification: { google: '_p_zaaCfRGRKhmepiOPHbNhb_4vCBSaXMjZ6SRdzKtQ' },
  };
}

export const viewport: Viewport = {
  themeColor: '#F6F2E9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // never trap pinch-zoom; it is an accessibility failure
};

import { headers } from 'next/headers';
import { countryFromHeaders, currencyForCountry } from '@/lib/geo';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
   * The display currency has to wrap the whole tree, not just the header:
   * prices render inside pages, the cart drawer and the search overlay, and
   * every one of them must agree with the switcher. Failing softly matters
   * here — a rates query that throws must not take the storefront down, it
   * should just leave everything in the base currency.
   */
  const [settings, rates, tracking] = await Promise.all([
    getStoreSettings(),
    prisma.fxRate.findMany({ orderBy: { code: 'asc' } }).catch(() => []),
    getTrackingSettings(),
  ]);
  const currencies = rates
    .filter((r) => r.rate > 0)
    .map((r) => ({ code: r.code, symbol: r.symbol, rate: r.rate }));

  /*
   * Cloudflare tells us the visitor's country for free, on every request. It is
   * only a SUGGESTION: it is applied after mount, below the shopper's own saved
   * choice, and it never changes what the payment providers actually charge.
   *
   * Absent when the site is not behind Cloudflare, in which case this is null
   * and the browser-locale guess takes over exactly as it did before.
   */
  const requestHeaders = await headers();
  const geoCurrency = currencyForCountry(
    countryFromHeaders(requestHeaders),
    currencies.map((c) => c.code)
  );

  /*
   * A currency named in the link (?currency=GBP, set by middleware) outranks
   * everything, and is rendered server-side so the first HTML already carries
   * it. Google Shopping links use it; a shopper can still switch afterwards.
   */
  const forcedHeader = requestHeaders.get('x-currency');
  const forcedCurrency =
    forcedHeader && (forcedHeader === settings.baseCurrency || currencies.some((c) => c.code === forcedHeader))
      ? forcedHeader
      : null;

  /*
   * Who this site is, in the form Google reads.
   *
   * Search results showed a generic globe beside the listing and the bare
   * domain where the name should be. Google takes the site NAME from WebSite
   * markup and the brand LOGO from Organization markup, and the homepage had
   * neither — so it had nothing to say "this is Twin Titans Emporium".
   *
   * The logo points at /icon.png because that is a file Next genuinely serves
   * from the app directory. public/ is not part of the deployed artifact on
   * this host, so a logo placed there would be a 404 and Google would ignore
   * the markup. At 192px it clears Google's 112px minimum for logos.
   *
   * The favicon itself is the separate half of this: favicon.ico and a
   * 192x192 icon.png in the app directory, because Google wants a square
   * favicon whose size is a multiple of 48px, and the old 512px icon was not.
   */
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  const brandJsonLd = siteUrl
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: settings.storeName,
          alternateName: ['Twin Titans', 'twintitansemporium.store'],
          url: `${siteUrl}/`,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: settings.storeName,
          url: `${siteUrl}/`,
          logo: `${siteUrl}/icon.png`,
          ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
        },
      ]
    : [];

  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="flex min-h-screen flex-col bg-bone">
        {brandJsonLd.length > 0 && (
          <script
            type="application/ld+json"
            // JSON.stringify escapes quotes; the < replacement stops a store name
            // containing "</script>" from ending the tag early.
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(brandJsonLd).replace(/</g, '\\u003c'),
            }}
          />
        )}
        {/*
          Ad pixels. Only the public pixel ids cross into the browser — the
          Conversions/Events API tokens stay server-side in lib/tracking.
        */}
        <Pixels metaPixelId={tracking.metaPixelId} tiktokPixelId={tracking.tiktokPixelId} />
        <CurrencyProvider
          options={currencies}
          baseCurrency={settings.baseCurrency}
          geoCurrency={geoCurrency}
          forcedCurrency={forcedCurrency}
        >
        {/* Warm washes + grain + vignette. Fixed, so it never repaints on scroll. */}
        <div className="ground" aria-hidden />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-onyx focus:px-4 focus:py-2 focus:text-bone"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <ChatWidget storeName={settings.storeName} />

        {/* Mounted once each; opened from anywhere via their exported helpers. */}
        <CartDrawer />
        <SearchOverlay />
        </CurrencyProvider>
      </body>
    </html>
  );
}
