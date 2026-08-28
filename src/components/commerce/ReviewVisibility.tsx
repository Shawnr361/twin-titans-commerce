'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hide or restore a review on the storefront.
 *
 * Hiding is not deleting. The review keeps counting towards the supplier's
 * average — a parcel that arrived broken still happened, whatever the customer
 * called us in the process.
 */
export function ReviewVisibility({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, hidden: !hidden }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Could not update.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="btn !rounded-full px-4 py-1.5 text-xs disabled:opacity-50"
      >
        {busy ? '…' : hidden ? 'Show on site' : 'Hide from site'}
      </button>
      {hidden && <p className="mt-1 text-xs text-warn">Hidden</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
