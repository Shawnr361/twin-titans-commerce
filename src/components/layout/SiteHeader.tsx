import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { CurrencySwitcher, type CurrencyOption } from '@/components/commerce/CurrencySwitcher';
import { HeaderActions } from './HeaderActions';
import { MobileNav } from './MobileNav';
import { Wordmark } from './Wordmark';

/**
 * Header.
 *
 * Quiet by design: a centred wordmark, a thin row of departments, and
 * icon utilities at the edge. The only division from the page is a hairline —
 * no shadow, no pills, no gradient CTA.
 */
export async function SiteHeader() {
  const [settings, collections, rates] = await Promise.all([
    getStoreSettings(),
    prisma.collection
      .findMany({
        where: { published: true },
        orderBy: { position: 'asc' },
        take: 6,
        select: { handle: true, title: true },
      })
      .catch(() => []),
    prisma.fxRate.findMany({ orderBy: { code: 'asc' } }).catch(() => []),
  ]);

  // Only offer currencies the merchant has actually set a rate for.
  const currencies: CurrencyOption[] = rates
    .filter((r) => r.rate > 0)
    .map((r) => ({ code: r.code, symbol: r.symbol, rate: r.rate }));

  const links = collections.map((c) => ({ href: `/collections/${c.handle}`, label: c.title }));

  return (
    <header className="sticky top-0 z-50 bg-bone/95 backdrop-blur">
      {settings.announcement && (
        <div className="bg-onyx py-2.5 text-center">
          <p className="label !text-bone/80 px-4">{settings.announcement}</p>
        </div>
      )}

      <div className="shell">
        <div className="flex h-16 items-center justify-between gap-3 sm:h-20 sm:gap-6">
          {/* Left: departments on desktop, menu button on mobile */}
          <div className="flex flex-1 items-center gap-7">
            <MobileNav links={links} storeName={settings.storeName} />
            <nav aria-label="Departments" className="hidden items-center gap-7 lg:flex">
              <Link href="/collections/all" className="label transition-colors hover:!text-onyx">
                Shop
              </Link>
              {links.slice(0, 4).map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="label transition-colors hover:!text-onyx"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Centre: wordmark */}
          <Link href="/" className="min-w-0 shrink-0" aria-label={`${settings.storeName} home`}>
            <Wordmark name={settings.storeName} />
          </Link>

          {/* Right: currency + icon utilities */}
          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
            {currencies.length > 1 && (
              <div className="hidden sm:block">
                <CurrencySwitcher options={currencies} baseCurrency={settings.baseCurrency} />
              </div>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <hr className="rule" />
    </header>
  );
}
