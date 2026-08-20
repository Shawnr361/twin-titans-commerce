'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Deletes a product from the catalogue.
 *
 * Two-step by design. The button sits beside the publish toggle, and a single
 * click that permanently removes a product from a live storefront is the kind
 * of control that eventually gets hit by accident. The second click is an
 * explicit "Confirm", and it goes back to idle on its own if left alone.
 *
 * If the product has been sold the server answers 409 and says how many order
 * lines are involved; confirming again sends `force`. Those orders survive
 * either way — OrderLineItem keeps its own copy of the title, sku and image.
 */
export function ProductDeleteButton({
  productId,
  title,
}: {
  productId: string;
  title: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'confirm' | 'sold'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldCount, setSoldCount] = useState(0);

  const reset = () => {
    setStage('idle');
    setError(null);
  };

  const run = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, force }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        requiresForce?: boolean;
        soldCount?: number;
      };

      if (res.status === 409 && body.requiresForce) {
        setSoldCount(body.soldCount ?? 0);
        setStage('sold');
        setError(body.error ?? null);
        return;
      }
      if (!res.ok) {
        setError(body.error ?? 'Could not delete.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'idle') {
    return (
      <button
        type="button"
        onClick={() => {
          setStage('confirm');
          window.setTimeout(() => setStage((s) => (s === 'confirm' ? 'idle' : s)), 5000);
        }}
        className="link text-label"
        aria-label={`Delete ${title}`}
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => run(stage === 'sold')}
          disabled={busy}
          className="link text-label text-danger"
        >
          {busy ? 'Deleting…' : stage === 'sold' ? `Delete anyway (${soldCount} sold)` : 'Confirm'}
        </button>
        <button type="button" onClick={reset} disabled={busy} className="link text-label">
          Cancel
        </button>
      </div>
      {error && <p className="max-w-xs text-right text-micro text-danger">{error}</p>}
    </div>
  );
}
