import Link from 'next/link';
import { prisma } from '@/lib/db';
import { announcementMessages, getStoreSettings } from '@/lib/settings';
import { CurrencySwitcher, type CurrencyOption } from '@/components/commerce/CurrencySwitcher';
import { HeaderActions } from './HeaderActions';
import { MobileNav } from './MobileNav';
import { AnnouncementBar } from './AnnouncementBar';
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

  // One announcement per line; split on the server so the client bundle never
  // imports the settings module (and with it Prisma).
  const announcements = announcementMessages(settings.announcement);

  const links = collections.map((c) => ({ href: `/collections/${c.handle}`, label: c.title }));

  return (
    <header className="sticky top-0 z-50 bg-bone/95 backdrop-blur">
      {announcements.length > 0 && (
        <AnnouncementBar
          messages={announcements}
          style={settings.announcementStyle}
          freeShippingOverMinor={settings.freeShippingOverMinor}
          baseCurrency={settings.baseCurrency}
        />
      )}

      <div className="shell">
        {/*
          Row one: utilities either side of a centred wordmark.
          Row two: departments, on their own line.

          Departments used to share row one, and the wordmark could not be
          centred while they did. The numbers are unambiguous at 1536px: the
          shell is 1216 wide, and the nav (642) plus wordmark (359) plus
          utilities (404) come to 1405. Forcing the centre with a 1fr/auto/1fr
          grid did not create the missing 189px — it let the nav overflow its
          cell and print straight through the wordmark.

          Giving departments their own row removes the competition, so the
          wordmark is genuinely centred at every width instead of centred
          only when nothing collides with it.
        */}
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 sm:h-20 sm:gap-6">
          {/* Left: menu button on mobile; deliberately light on desktop */}
          <div className="flex min-w-0 items-center gap-7">
            <MobileNav
              links={links}
              storeName={settings.storeName}
              currencies={currencies}
              baseCurrency={settings.baseCurrency}
            />
          </div>

          {/* Centre: wordmark */}
          <Link href="/" className="justify-self-center" aria-label={`${settings.storeName} home`}>
            <Wordmark name={settings.storeName} animate />
          </Link>

          {/* Right: currency + icon utilities */}
          <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4">
            {currencies.length > 1 && (
              <div className="hidden sm:block">
                <CurrencySwitcher options={currencies} baseCurrency={settings.baseCurrency} />
              </div>
            )}
            <HeaderActions />
          </div>
        </div>

        {/*
          Departments. `whitespace-nowrap` is load-bearing: the label style uses
          0.14em tracking, which makes multi-word departments ("Home & Living")
          wrap and wreck the row. With a full row to itself the nav has ~1216px
          for ~642px of links, so it fits with room to spare and can simply
          centre.
        */}
        <nav
          aria-label="Departments"
          className="hidden items-center justify-center gap-7 pb-3 lg:flex"
        >
          <Link
            href="/collections/all"
            className="label whitespace-nowrap !tracking-[0.1em] transition-colors hover:!text-onyx"
          >
            Shop
          </Link>
          {links.slice(0, 5).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="label whitespace-nowrap !tracking-[0.1em] transition-colors hover:!text-onyx"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <hr className="rule" />
    </header>
  );
}
