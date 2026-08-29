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
  /*
   * The server refuses to delete a PAID order without ?force=true, and returns
   * 409 with the reason. Previously that dead-ended at "Failed — why?", so the
   * test orders taken with the old gateway could not be cleared from the admin
   * at all. The escalation is offered here, with the server's own wording, and
   * still costs a second deliberate click.
   */
  const [blocked, setBlocked] = useState<string | null>(null);

  async function remove(force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${orderId}${force ? '?force=true' : ''}`,
        { method: 'DELETE' }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409 && !force) {
        setBlocked(body.error ?? 'That order is paid and was not deleted.');
        setArmed(false);
        return;
      }
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

  if (blocked) {
    return (
      <div className="max-w-xs text-right">
        <p className="text-micro text-warn">{blocked}</p>
        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => remove(true)}
            disabled={busy}
            className="border border-danger/60 px-2 py-1 text-micro text-danger disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete anyway'}
          </button>
          <button
            type="button"
            onClick={() => setBlocked(null)}
            className="text-micro text-greige"
          >
            Keep it
          </button>
        </div>
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
      onClick={() => remove()}
      disabled={busy}
      className="border border-warn/60 px-2 py-1 text-micro text-warn disabled:opacity-60"
    >
      {busy ? 'Deleting…' : 'Confirm'}
    </button>
  );
}
