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
  const [settings, rates] = await Promise.all([
    getStoreSettings(),
    prisma.fxRate.findMany({ orderBy: { code: 'asc' } }).catch(() => []),
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
  const geoCurrency = currencyForCountry(
    countryFromHeaders(await headers()),
    currencies.map((c) => c.code)
  );

  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="flex min-h-screen flex-col bg-bone">
        <CurrencyProvider
          options={currencies}
          baseCurrency={settings.baseCurrency}
          geoCurrency={geoCurrency}
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
        <ChatWidget />

        {/* Mounted once each; opened from anywhere via their exported helpers. */}
        <CartDrawer />
        <SearchOverlay />
        </CurrencyProvider>
      </body>
    </html>
  );
}
