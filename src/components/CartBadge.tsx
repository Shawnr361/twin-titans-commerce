'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Reads the cart cookie directly so the count updates without a round trip. */
export function CartBadge() {
  const [count, setCount] = useState(0);
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
    // Re-read on navigation and when another tab changes the cart.
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
      className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-white/5 transition hover:border-accent/60"
      aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3h2l2.4 12.2a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 7H6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20" r="1.4" fill="currentColor" />
        <circle cx="17" cy="20" r="1.4" fill="currentColor" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
