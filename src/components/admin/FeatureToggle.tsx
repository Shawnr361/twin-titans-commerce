'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Choose whether a product leads the homepage hero.
 *
 * The hero shows featured live products first; with none chosen it falls back
 * to the newest imports, which is how it picked a toilet seat cover.
 */
export function FeatureToggle({ productId, featured }: { productId: string; featured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products/featured', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, featured: !featured }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Update failed.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={featured ? 'Shown in the homepage hero' : 'Show this in the homepage hero'}
        className={
          featured
            ? 'btn btn-primary px-4 py-2 text-xs'
            : 'btn btn-secondary px-4 py-2 text-xs'
        }
      >
        {busy ? '…' : featured ? '★ Featured' : 'Feature'}
      </button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
