'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Price } from './Price';

export interface VariantOption {
  id: string;
  title: string;
  priceMinor: number;
  compareAtMinor: number | null;
  imageUrl: string | null;
  available: boolean;
  options: Record<string, string>;
}

export function AddToCart({
  variants,
  currency,
  onVariantChange,
}: {
  variants: VariantOption[];
  currency: string;
  onVariantChange?: (v: VariantOption) => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    variants.find((v) => v.available)?.id ?? variants[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  const select = (v: VariantOption) => {
    setSelectedId(v.id);
    setAdded(false);
    onVariantChange?.(v);
  };

  const add = async (buyNow: boolean) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId: selected.id, quantity }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not add to cart.');

      setAdded(true);
      router.refresh();
      if (buyNow) router.push('/checkout');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!selected) return <p className="text-sm text-mut">This product has no variants configured.</p>;

  return (
    <div className="space-y-5">
      {variants.length > 1 && (
        <div>
          <span className="label">Choose an option</span>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => select(v)}
                disabled={!v.available}
                aria-pressed={v.id === selectedId}
                className={`rounded-xl border px-3.5 py-2 text-sm transition ${
                  v.id === selectedId
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-white/5 text-mut hover:border-accent/50 hover:text-ink'
                } ${!v.available ? 'cursor-not-allowed line-through opacity-40' : ''}`}
              >
                {v.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-baseline gap-3">
        <Price
          minor={selected.priceMinor}
          currency={currency}
          className="text-3xl font-extrabold tracking-tight text-ink"
        />
        {selected.compareAtMinor && selected.compareAtMinor > selected.priceMinor && (
          <Price minor={selected.compareAtMinor} currency={currency} className="text-base" strike />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-line bg-black/30">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-4 py-3 text-mut transition hover:text-ink"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="px-4 py-3 text-mut transition hover:text-ink"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => add(false)}
          disabled={busy || !selected.available}
          className="btn-ghost flex-1 sm:flex-none"
        >
          {busy ? 'Adding…' : added ? 'Added ✓' : 'Add to cart'}
        </button>

        <button
          type="button"
          onClick={() => add(true)}
          disabled={busy || !selected.available}
          className="btn-primary flex-1 sm:flex-none"
        >
          Buy it now
        </button>
      </div>

      {!selected.available && (
        <p className="text-sm text-amber-400">This option is currently unavailable.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
