'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Delete one order from the list.
 *
 * Two-step rather than a browser confirm(): the second click is a visibly
 * different, labelled button, so it cannot be dismissed by muscle memory the
 * way a native dialog can. It reverts on its own if left alone.
 */
export function DeleteOrderButton({ orderId, number }: { orderId: string; number: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Could not delete that order.');
        setArmed(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
      setArmed(false);
    } finally {
      setBusy(false);
    }
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
        aria-label={`Delete order ${number}`}
        className="text-micro text-greige transition-colors hover:text-warn"
      >
        Delete
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="border border-warn/60 px-2 py-1 text-micro text-warn disabled:opacity-60"
    >
      {busy ? 'Deleting…' : 'Confirm'}
    </button>
  );
}
