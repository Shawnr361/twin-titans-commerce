'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Change {
  variant: string;
  cost: string;
  from: string;
  to: string;
  marginPct: number;
}
interface Refused {
  variant: string;
  reason: string;
}

/**
 * Re-price one product from the product list.
 *
 * Previews before it saves. Re-pricing rewrites what customers are charged, so
 * the destructive step is never the first click — the merchant sees the old
 * price, the new price and the resulting margin per variant, and only then
 * confirms. Anything the server refuses (no landed cost, or a price at or
 * below it) is listed rather than silently dropped.
 */
export function EditPricing({
  productId,
  currentMarginPct,
}: {
  productId: string;
  currentMarginPct: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState(String(currentMarginPct));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ changes: Change[]; refused: Refused[] } | null>(null);

  async function send(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, marginPct: Number(margin), apply }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not re-price.');
        return;
      }
      if (apply) {
        setOpen(false);
        setPreview(null);
        router.refresh();
      } else {
        setPreview({ changes: body.changes ?? [], refused: body.refused ?? [] });
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-greige transition-colors hover:text-verdigris"
      >
        Edit pricing
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-rule pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-greige">
          Target margin %
          <input
            type="number"
            min={0}
            max={95}
            step={1}
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            className="field mt-1 w-24 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => send(false)}
          disabled={busy}
          className="btn btn-secondary px-4 py-1.5 text-xs"
        >
          {busy ? 'Working…' : 'Preview'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPreview(null);
            setError(null);
          }}
          className="text-xs text-quiet hover:text-onyx"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-xs text-warn">{error}</p>}

      {preview && (
        <div className="space-y-2 text-xs">
          {preview.changes.length === 0 && preview.refused.length === 0 && (
            <p className="text-greige">Nothing would change at that margin.</p>
          )}

          {preview.changes.map((c) => (
            <p key={c.variant} className="text-greige">
              <span className="text-onyx">{c.variant}</span>: {c.from} → {c.to}{' '}
              <span className="text-quiet">
                (cost {c.cost}, margin {c.marginPct}%)
              </span>
            </p>
          ))}

          {preview.refused.map((r) => (
            <p key={r.variant} className="text-warn">
              {r.variant}: {r.reason}
            </p>
          ))}

          {preview.changes.length > 0 && (
            <button
              type="button"
              onClick={() => send(true)}
              disabled={busy}
              className="btn btn-primary px-4 py-1.5 text-xs"
            >
              {busy ? 'Saving…' : `Apply to ${preview.changes.length} variant(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
