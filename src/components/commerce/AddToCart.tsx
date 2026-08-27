'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Magnetic } from '@/components/motion/Magnetic';
import { IconBag, IconCheck, IconMinus, IconPlus } from '@/components/icons';
import { CART_CHANGED_EVENT, openCartDrawer } from './CartDrawer';
import { Price } from './Price';
import { pickerLabels } from '@/lib/vendor';
import { useVariantMedia } from './VariantMediaContext';


export interface VariantOption {
  id: string;
  title: string;
  priceMinor: number;
  compareAtMinor: number | null;
  imageUrl: string | null;
  available: boolean;
  options: Record<string, string>;
}

/**
 * Variant selection, quantity and the buy controls.
 *
 * Unavailable variants stay visible but struck through rather than being
 * removed — a customer who came for a colour that has sold out needs to see
 * that it exists and is gone, not silently wonder whether they misremembered.
 */
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
  const { showImage } = useVariantMedia();
  const [selectedId, setSelectedId] = useState(
    variants.find((v) => v.available)?.id ?? variants[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  /*
   * Computed across the whole set, not per button: telling "Default" from
   * "Default" requires knowing the others exist.
   */
  const labels = pickerLabels(variants.map((v) => v.title));
  const labelFor = (id: string) => labels[variants.findIndex((v) => v.id === id)] ?? '';

  const select = (v: VariantOption) => {
    setSelectedId(v.id);
    setAdded(false);
    showImage(v.imageUrl);
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
      if (!res.ok) throw new Error(body?.error ?? 'Could not add to bag.');

      setAdded(true);
      router.refresh();

      if (buyNow) {
        router.push('/checkout');
        return;
      }

      // Open the bag rather than navigating away — the customer keeps their
      // place, which is the whole point of the drawer.
      window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
      openCartDrawer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!selected) {
    return <p className="text-body text-greige">This product has no options configured.</p>;
  }

  const reduced =
    selected.compareAtMinor && selected.compareAtMinor > selected.priceMinor
      ? Math.round((1 - selected.priceMinor / selected.compareAtMinor) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Price */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Price
          minor={selected.priceMinor}
          currency={currency}
          className="font-display text-d3 text-onyx"
        />
        {reduced > 0 && selected.compareAtMinor && (
          <>
            <Price minor={selected.compareAtMinor} currency={currency} className="text-body" strike />
            <span className="tag tag-sale">−{reduced}%</span>
          </>
        )}
      </div>

      {/* Variants */}
      {variants.length > 1 && (
        <fieldset>
          <legend className="label mb-3">
            Option
            <span className="ml-2 normal-case tracking-normal text-onyx">
              {labelFor(selected.id)}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => select(v)}
                disabled={!v.available}
                aria-pressed={v.id === selectedId}
                className={`border px-4 py-2.5 text-label transition-colors duration-1 ${
                  v.id === selectedId
                    ? 'border-onyx bg-onyx text-bone'
                    : 'border-ruleStrong text-ink hover:border-onyx'
                } ${!v.available ? 'cursor-not-allowed text-quiet line-through opacity-50' : ''}`}
              >
                {labelFor(v.id)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Quantity + actions */}
      <div className="space-y-3">
        <div className="flex items-stretch gap-3">
          <div className="flex items-center border border-ruleStrong">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="px-4 py-3 text-greige transition-colors hover:text-onyx disabled:opacity-30"
              aria-label="Decrease quantity"
            >
              <IconMinus size={14} />
            </button>
            <span className="min-w-8 text-center text-body tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="px-4 py-3 text-greige transition-colors hover:text-onyx"
              aria-label="Increase quantity"
            >
              <IconPlus size={14} />
            </button>
          </div>

          <Magnetic className="flex-1">
            <button
              type="button"
              onClick={() => add(false)}
              disabled={busy || !selected.available}
              className="btn btn-primary sheen w-full"
            >
              {added && !busy ? <IconCheck size={16} /> : <IconBag size={16} />}
              {busy ? 'Adding…' : added ? 'Added to bag' : 'Add to bag'}
            </button>
          </Magnetic>
        </div>

        <button
          type="button"
          onClick={() => add(true)}
          disabled={busy || !selected.available}
          className="btn btn-secondary w-full"
        >
          Buy it now
        </button>
      </div>

      {!selected.available && (
        <p className="text-body text-warn">
          This option is sold out. Choose another, or contact us and we will tell you when it
          returns.
        </p>
      )}

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
