'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Cancel an order a customer no longer wants.
 *
 * Cancelling, not deleting. If money has moved the order is what a refund
 * reconciles against, and a customer who changes their mind is an ordinary
 * event that the books should record rather than forget.
 *
 * Two-step like the delete control, and it surfaces the server's warnings
 * afterwards — a placed supplier order and an unrefunded payment both still
 * need a human, and neither is visible from the list.
 */
export function CancelOrderButton({
  orderId,
  number,
  status,
}: {
  orderId: string;
  number: number;
  status: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Nothing to cancel — and re-cancelling would write a misleading event.
  if (status === 'CANCELLED' || status === 'REFUNDED') return null;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', reason: 'Customer changed their mind' }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        warnings?: string[];
      };
      if (!res.ok) {
        setError(body.error ?? 'Could not cancel that order.');
        setArmed(false);
        return;
      }
      if (body.warnings?.length) {
        // Shown in place rather than as a toast: these outlive a refresh.
        setWarnings(body.warnings);
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  if (warnings.length > 0) {
    return (
      <div className="text-right">
        {warnings.map((w) => (
          <p key={w} className="text-micro text-warn">
            {w}
          </p>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={() => setError(null)}
        title={error}
        className="text-left text-micro text-warn underline underline-offset-2"
      >
        Failed — why?
      </button>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 5000);
        }}
        aria-label={`Cancel order ${number}`}
        className="text-micro text-greige transition-colors hover:text-warn"
      >
        Cancel
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy}
      className="border border-warn/60 px-2 py-1 text-micro text-warn disabled:opacity-60"
    >
      {busy ? 'Cancelling…' : 'Confirm cancel'}
    </button>
  );
}
