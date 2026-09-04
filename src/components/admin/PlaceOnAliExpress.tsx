'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ALIEXPRESS_CART_URL } from '@/lib/dropship/aliexpress-cart';

/**
 * Place a customer's order with AliExpress, through the API.
 *
 * THERE IS NO CART API — THIS IS THE "EVERYTHING FILLED IN" PATH
 * -------------------------------------------------------------
 * AliExpress's dropshipping API has three methods: product details, shipping
 * calculation, and order create. There is no add-to-cart endpoint, and DSers
 * does not use one either — it calls the same `aliexpress.ds.order.create`,
 * which is documented as "Order Create and Pay". So a basket that arrives
 * pre-filled is not something the platform offers; the API's own equivalent is
 * this, which sends the product, the SKU, the quantity AND the delivery
 * address in a single call and pays for it.
 *
 * WHICH MEANS THE CONFIRM STEP IS THE ONLY BRAKE
 * ----------------------------------------------
 * There is no confirmation screen on AliExpress's side. The moment the call
 * succeeds, money has moved and goods are on their way. So the second press
 * names the amount rather than saying OK, and it disarms itself if left alone.
 *
 * FAILURES ARE SHOWN LOUDLY, AND IN FULL
 * --------------------------------------
 * This button has never completed a placement — checked against the order
 * timelines, every "Supplier order placed" event on orders #17 and #18 carries
 * the wording of the manual form, not the API's. The old version reported the
 * reason in small grey text that was easy to miss, which is why it read as
 * "doing nothing". A refusal is nearly always a missing balance, an unapproved
 * auto-pay, or a SKU the listing no longer sells, and only AliExpress's own
 * wording separates them — so the raw reply is printed in full, selectable,
 * with a button to copy it.
 *
 * ITEMS WITH NO SKU CANNOT COME THIS WAY
 * --------------------------------------
 * The API would let AliExpress choose the variant, and the customer would get
 * the wrong colour — the most expensive mistake in dropshipping. Those legs are
 * refused before any call is made, so they cost nothing, and they appear below
 * as links to buy by hand instead. That block is not a second way to do the
 * same job; it is the only way to do a job this button will not touch.
 */
export interface ManualLine {
  title: string;
  url: string;
  variant: string;
  sku: string;
  quantity: number;
}

export function PlaceOnAliExpress({
  orderId,
  orderNumber,
  cost,
  sellerCount,
  manualLines,
  addressText,
}: {
  orderId: string;
  orderNumber: number;
  /** What the automatic legs will cost, formatted. */
  cost: string;
  sellerCount: number;
  /** Legs the API refuses — no supplier SKU recorded. */
  manualLines: ManualLine[];
  addressText: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const place = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/fulfilment/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json().catch(() => ({}));
      setResult({
        ok: Boolean(body?.ok),
        /*
         * Never an empty string. "Nothing happened" was the old failure mode,
         * and a blank panel would reproduce it exactly.
         */
        detail:
          String(body?.detail ?? body?.error ?? '').trim() ||
          `AliExpress returned HTTP ${res.status} with no message.`,
      });
      if (body?.ok) router.refresh();
    } catch (err) {
      setResult({
        ok: false,
        detail: `Could not reach the store: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(addressText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  /** Nothing to place through the API when every leg lacks a SKU. */
  const hasAutomatic = sellerCount > 0;

  return (
    <div className="space-y-4">
      {hasAutomatic && !result && !armed && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setArmed(true);
              window.setTimeout(() => setArmed(false), 8000);
            }}
            className="btn btn-primary !rounded-full px-5 py-2 text-xs"
          >
            Place on AliExpress
          </button>
          <p className="text-micro text-greige">
            Sends the SKU, quantity and the customer&apos;s address to AliExpress and pays{' '}
            {cost} from your AliExpress balance
            {sellerCount > 1 ? `, as ${sellerCount} orders (one per seller)` : ''}. There is no
            cart step and no confirmation on their side.
          </p>
        </div>
      )}

      {hasAutomatic && !result && armed && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={place}
            disabled={busy}
            className="border border-danger/60 px-4 py-2 text-xs text-danger disabled:opacity-60"
          >
            {busy ? 'Placing…' : `Confirm — pays ${cost} now`}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-micro text-greige underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

      {result && (
        <div
          className={`space-y-2 border p-4 ${
            result.ok ? 'border-verdigris/50 bg-verdigris/5' : 'border-danger/50 bg-danger/5'
          }`}
        >
          <p className={`text-sm font-bold ${result.ok ? 'text-verdigris' : 'text-danger'}`}>
            {result.ok ? `Order #${orderNumber} placed with AliExpress` : 'AliExpress refused it'}
          </p>
          {/*
            Selectable and wrapped rather than truncated. The exact wording is
            the whole diagnostic value of a failure.
          */}
          <p className="select-all whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-onyx">
            {result.detail}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            {!result.ok && (
              <>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(result.detail).catch(() => {})}
                  className="text-micro text-greige underline underline-offset-2"
                >
                  Copy the error
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="text-micro text-greige underline underline-offset-2"
                >
                  Try again
                </button>
              </>
            )}
            {result.ok && (
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-micro text-greige underline underline-offset-2"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/*
        The legs the API will not touch. Kept visually quieter than the button
        above and explicitly labelled, so this reads as "these are different"
        rather than as a second way to do the same thing.
      */}
      {manualLines.length > 0 && (
        <div className="border-l-2 border-warn/60 pl-4">
          <p className="text-micro text-warn">
            {manualLines.length} item{manualLines.length === 1 ? ' has' : 's have'} no supplier SKU
            recorded, so the API cannot guarantee the variant and refuses{' '}
            {manualLines.length === 1 ? 'it' : 'them'} before spending anything. Buy{' '}
            {manualLines.length === 1 ? 'this one' : 'these'} by hand:
          </p>
          <ol className="mt-2 space-y-1.5">
            {manualLines.map((line, i) => (
              <li key={i} className="text-micro text-greige">
                <a
                  href={line.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-verdigris underline-offset-2 hover:underline"
                >
                  {line.title || line.url}
                </a>
                <span className="text-quiet">
                  {' — '}
                  {line.variant} · <strong className="text-greige">Qty {line.quantity}</strong>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyAddress}
              className="text-micro text-greige underline underline-offset-2"
            >
              {copied ? 'Address copied ✓' : 'Copy the delivery address'}
            </button>
            <a
              href={ALIEXPRESS_CART_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-micro text-greige underline underline-offset-2"
            >
              Open the AliExpress cart
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
