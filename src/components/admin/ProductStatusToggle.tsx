'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Publish / unpublish a product.
 *
 * `blocked` is set when any variant would sell below cost. Publishing is
 * refused outright in that case rather than warned about — a loss-making live
 * product costs real money on every single sale, and a warning is too easy to
 * click past.
 */
export function ProductStatusToggle({
  productId,
  status,
  blocked,
}: {
  productId: string;
  status: string;
  blocked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = status === 'ACTIVE';

  const toggle = async () => {
    if (!isActive && blocked) {
      setError('Fix the loss-making variant before publishing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, status: isActive ? 'DRAFT' : 'ACTIVE' }),
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
        className={isActive ? 'btn-ghost px-4 py-2 text-xs' : 'btn-primary px-4 py-2 text-xs'}
      >
        {busy ? '…' : isActive ? 'Unpublish' : 'Publish'}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
