'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Place one supplier order with AliExpress.
 *
 * TWO-STEP, AND THE SECOND STEP SAYS WHAT IT COSTS.
 *
 * The underlying API is "Order Create and Pay": there is no basket, no draft,
 * and no confirmation screen on AliExpress's side. The moment this succeeds,
 * money has moved and goods are on their way to the customer. So the confirm
 * button names the amount rather than saying "OK", and it reverts on its own
 * if left alone.
 */
export function PlaceWithSupplier({
  supplierOrderId,
  cost,
  disabled,
  disabledReason,
}: {
  supplierOrderId: string;
  cost: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (disabled) {
    return (
      <p className="text-micro text-greige" title={disabledReason}>
        {disabledReason ?? 'Cannot place automatically.'}
      </p>
    );
  }

  const place = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/fulfilment/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supplierOrderId }),
      });
      const body = await res.json().catch(() => ({}));
      setMessage({ ok: Boolean(body?.ok), text: String(body?.detail ?? body?.error ?? '') });
      if (body?.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  if (message) {
    return (
      <div className={`text-micro ${message.ok ? 'text-verdigris' : 'text-warn'}`}>
        <p className="break-words">{message.text}</p>
        {!message.ok && (
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="mt-1 underline underline-offset-2"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 6000);
        }}
        className="btn btn-primary !rounded-full px-5 py-2 text-xs"
      >
        Place with supplier
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={place}
      disabled={busy}
      className="border border-danger/60 px-3 py-2 text-xs text-danger disabled:opacity-60"
    >
      {busy ? 'Placing…' : `Confirm — pays ${cost} now`}
    </button>
  );
}
