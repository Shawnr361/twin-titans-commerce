'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Cart indicator. Reads the cart cookie directly so the count is correct
 * immediately after adding an item, without a server round trip.
 *
 * Rendered as a word plus a count rather than an icon badge — luxury retail
 * labels its utilities.
 */
export function CartCount() {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const read = () => {
      const match = document.cookie.match(/(?:^|;\s*)tt_cart=([^;]*)/);
      if (!match) return setCount(0);
      try {
        const lines = JSON.parse(decodeURIComponent(decodeURIComponent(match[1])));
        if (!Array.isArray(lines)) return setCount(0);
        setCount(lines.reduce((sum: number, l: { quantity?: number }) => sum + (l.quantity ?? 0), 0));
      } catch {
        setCount(0);
      }
    };

    read();
    const interval = setInterval(read, 1500);
    window.addEventListener('focus', read);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', read);
    };
  }, [pathname]);

  return (
    <Link
      href="/cart"
      className="label hover:!text-onyx transition-colors"
      aria-label={count ? `Bag, ${count} item${count === 1 ? '' : 's'}` : 'Bag, empty'}
    >
      Bag
      {/* Reserve the slot so the header doesn't shift when the count loads. */}
      <span className="ml-1 inline-block min-w-[1.25ch] tabular-nums">
        {count === null ? '' : `(${count})`}
      </span>
    </Link>
  );
}
