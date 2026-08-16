'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductCardData } from './ProductCard';
import { IconClose, IconSearch } from '@/components/icons';
import { Price } from './Price';

export const SEARCH_OPEN_EVENT = 'tt:search-open';

export function openSearch() {
  window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
}

/**
 * Quick search.
 *
 * Opens over the page from the header icon or with Cmd/Ctrl-K. Results are
 * live as you type, with the arrow keys and Enter working the list, so the
 * whole thing is usable without touching the mouse.
 *
 * Two details that make live search feel right rather than janky:
 *  - requests are debounced AND each one aborts the previous, so a slow
 *    earlier response can never overwrite a newer one (the classic race that
 *    makes results flicker back to a stale query);
 *  - the panel opens showing newest products instead of an empty box.
 */
export function SearchOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const body = await res.json();
      setResults(body.results ?? []);
      setCursor(-1);
    } catch {
      /* aborted or offline — keep whatever is on screen */
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Open via header icon or Cmd/Ctrl-K.
  useEffect(() => {
    const onOpen = () => {
      lastFocused.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener(SEARCH_OPEN_EVENT, onOpen);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(SEARCH_OPEN_EVENT, onOpen);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // On open: lock scroll, focus the field, and preload newest products.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    search(query);

    return () => {
      document.body.style.overflow = '';
      lastFocused.current?.focus?.();
    };
    // `query` intentionally omitted: this runs on open, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search]);

  // Debounce typing.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 220);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setCursor(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(-1, c - 1));
    }
    if (e.key === 'Enter') {
      const chosen = results[cursor];
      if (chosen) {
        e.preventDefault();
        router.push(
          chosen.landingPageHandle
            ? `/pages/${chosen.landingPageHandle}`
            : `/products/${chosen.handle}`
        );
        close();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Search">
      <div onClick={close} aria-hidden className="absolute inset-0 bg-onyx/30" />

      <div
        ref={panelRef}
        className="relative mx-auto mt-0 max-h-[100dvh] w-full overflow-y-auto overscroll-contain bg-bone sm:mt-20 sm:max-h-[80vh] sm:max-w-2xl sm:border sm:border-ruleStrong"
      >
        <div className="sticky top-0 flex items-center gap-3 border-b border-rule bg-bone px-5 py-4">
          <IconSearch size={20} className="shrink-0 text-quiet" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search the catalogue"
            aria-label="Search products"
            aria-controls="search-results"
            className="w-full bg-transparent text-body text-onyx outline-none placeholder:text-quiet"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="-mr-2 shrink-0 p-2.5 text-greige transition-colors hover:text-onyx"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div id="search-results" aria-live="polite" className="px-5 pb-6">
          <p className="label py-4">
            {query ? (loading ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`) : 'New arrivals'}
          </p>

          {results.length === 0 && !loading ? (
            <div className="pb-6">
              <p className="text-body text-greige">
                {query
                  ? `Nothing matches “${query}”.`
                  : 'The catalogue is still opening.'}
              </p>
              <Link href="/collections/all" onClick={close} className="link mt-4 inline-block text-label">
                Browse everything
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {results.map((p, i) => (
                <li key={p.handle}>
                  <Link
                    href={
                      p.landingPageHandle
                        ? `/pages/${p.landingPageHandle}`
                        : `/products/${p.handle}`
                    }
                    onClick={close}
                    onMouseEnter={() => setCursor(i)}
                    aria-current={i === cursor ? 'true' : undefined}
                    className={`flex items-center gap-4 py-3 transition-colors ${
                      i === cursor ? 'bg-bone2' : ''
                    }`}
                  >
                    <div className="media aspect-product w-14 shrink-0">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" loading="lazy" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-body text-onyx">{p.title}</p>
                      {p.vendor && <p className="text-micro text-quiet">{p.vendor}</p>}
                    </div>
                    <Price
                      minor={p.priceMinor}
                      currency={p.currency}
                      className="shrink-0 text-label text-onyx"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="hidden border-t border-rule px-5 py-3 text-micro text-quiet sm:block">
          ↑↓ to navigate · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}
