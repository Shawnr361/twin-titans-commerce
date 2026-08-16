'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconBag, IconSearch, IconTruck } from '@/components/icons';
import { openCartDrawer } from '@/components/commerce/CartDrawer';
import { openSearch } from '@/components/commerce/SearchOverlay';

/**
 * Icon utilities.
 *
 * Every control here is icon-only, so every control carries an `aria-label` —
 * swapping a word for a picture removes the accessible name unless you put it
 * back deliberately.
 *
 * The bag count is read straight from the cart cookie so it is correct the
 * instant an item is added, with no server round trip.
 */
export function HeaderActions() {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const read = () => {
      const match = document.cookie.match(/(?:^|;\s*)tt_cart=([^;]*)/);
      if (!match) return setCount(0);
      try {
        const lines = JSON.parse(decodeURIComponent(decodeURIComponent(match[1])));
        if (!Array.isArray(lines)) return setCount(0);
        setCount(lines.reduce((s: number, l: { quantity?: number }) => s + (l.quantity ?? 0), 0));
      } catch {
        setCount(0);
      }
    };

    read();
    const interval = setInterval(read, 1200);
    window.addEventListener('focus', read);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', read);
    };
  }, [pathname]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search products"
        title="Search (Ctrl K)"
        className="p-2.5 text-greige transition-colors hover:text-onyx"
      >
        <IconSearch size={19} />
      </button>

      <Link
        href="/orders/track"
        aria-label="Track an order"
        title="Track an order"
        className="hidden p-2.5 text-greige transition-colors hover:text-onyx sm:block"
      >
        <IconTruck size={19} />
      </Link>

      <button
        type="button"
        onClick={openCartDrawer}
        aria-label={count ? `Open bag, ${count} item${count === 1 ? '' : 's'}` : 'Open bag, empty'}
        title="Bag"
        className="relative p-2.5 text-greige transition-colors hover:text-onyx"
      >
        <IconBag size={19} />
        {count !== null && count > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-onyx px-1 text-[0.625rem] font-medium tabular-nums leading-none text-bone">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  );
}
