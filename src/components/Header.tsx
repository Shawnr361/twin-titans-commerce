import Link from 'next/link';
import { getRates } from '@/lib/fx';
import { getStoreSettings } from '@/lib/settings';
import { CurrencySwitcher } from './CurrencySwitcher';
import { CartBadge } from './CartBadge';
import { prisma } from '@/lib/db';

export async function Header() {
  const [settings, rates, collections] = await Promise.all([
    getStoreSettings(),
    getRates(),
    prisma.collection
      .findMany({
        where: { published: true },
        orderBy: { position: 'asc' },
        take: 6,
        select: { handle: true, title: true },
      })
      .catch(() => []),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      {settings.announcement && (
        <div className="bg-gradient-to-r from-accent/25 via-accent2/20 to-accent/25 py-2 text-center text-xs font-medium text-ink">
          {settings.announcement}
        </div>
      )}

      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-sm font-black text-white shadow-glow"
          >
            TT
          </span>
          <span className="hidden text-sm font-bold tracking-tight sm:block">
            {settings.storeName}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-mut lg:flex">
          <Link href="/collections/all" className="transition hover:text-ink">
            Shop all
          </Link>
          {collections.map((c) => (
            <Link key={c.handle} href={`/collections/${c.handle}`} className="transition hover:text-ink">
              {c.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <CurrencySwitcher
            currencies={settings.displayCurrencies}
            baseCurrency={settings.baseCurrency}
            rates={rates}
          />
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
