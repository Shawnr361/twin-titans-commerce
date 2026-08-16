import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';
import { CartCount } from './CartCount';
import { Wordmark } from './Wordmark';

/**
 * Header.
 *
 * Luxury retail navigation is quiet: a centred wordmark, a thin row of
 * categories, and utilities at the edge. No pills, no gradient CTA, no drop
 * shadow — the only division from the page is a single hairline.
 */
export async function SiteHeader() {
  const [settings, collections] = await Promise.all([
    getStoreSettings(),
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
    <header className="sticky top-0 z-40 bg-bone/95 backdrop-blur">
      {settings.announcement && (
        <div className="bg-onyx py-2.5 text-center">
          <p className="label !text-bone/80 px-4">{settings.announcement}</p>
        </div>
      )}

      <div className="shell">
        <div className="flex h-16 items-center justify-between gap-3 sm:h-20 sm:gap-8">
          {/* Left: catalogue */}
          <nav aria-label="Categories" className="hidden flex-1 items-center gap-7 lg:flex">
            <Link href="/collections/all" className="label hover:!text-onyx transition-colors">
              Shop
            </Link>
            {collections.slice(0, 4).map((c) => (
              <Link
                key={c.handle}
                href={`/collections/${c.handle}`}
                className="label hover:!text-onyx transition-colors"
              >
                {c.title}
              </Link>
            ))}
          </nav>

          {/* Centre: wordmark */}
          <Link href="/" className="min-w-0 lg:flex-none" aria-label={`${settings.storeName} home`}>
            <Wordmark name={settings.storeName} />
          </Link>

          {/* Right: utilities. shrink-0 so the bag can never be pushed out. */}
          <div className="flex shrink-0 items-center justify-end gap-5 lg:flex-1 lg:gap-6">
            <Link
              href="/orders/track"
              className="label hover:!text-onyx hidden transition-colors sm:block"
            >
              Track
            </Link>
            <CartCount />
          </div>
        </div>
      </div>

      <hr className="rule" />

      {/* Mobile category row — horizontally scrollable, never wrapping. */}
      <div className="scroll-x border-b border-rule lg:hidden">
        <nav aria-label="Categories" className="flex w-max gap-6 px-5 py-3">
          <Link href="/collections/all" className="label whitespace-nowrap">
            Shop
          </Link>
          {collections.map((c) => (
            <Link
              key={c.handle}
              href={`/collections/${c.handle}`}
              className="label whitespace-nowrap"
            >
              {c.title}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
