'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMoney } from '@/lib/money';

interface Sheet {
  supplierOrderId: string;
  /** The customer order — a refund is recorded against this, not the purchase. */
  orderId: string;
  supplierName: string;
  platform: string;
  orderNumber: number;
  status: string;
  lines: {
    url: string;
    sku: string;
    variant: string;
    quantity: number;
    title: string | null;
    imageUrl: string | null;
  }[];
  shipTo: {
    name: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postcode?: string;
    country: string;
  };
  text: string;
  estimatedCostMinor: number;
  currency: string;
}

export function FulfilmentCard({ sheet }: { sheet: Sheet }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sheet.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was blocked — select the text below and copy it manually.');
    }
  };

  const act = async (
    action: 'place' | 'ship' | 'cancel' | 'refund',
    payload: Record<string, string>
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/fulfilment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        /*
         * Refund acts on the customer ORDER, cancel on this one supplier
         * purchase — an order can split across suppliers, so they are not
         * interchangeable and must not send the same id.
         */
        body: JSON.stringify(
          action === 'refund'
            ? { action, orderId: sheet.orderId, ...payload }
            : { action, supplierOrderId: sheet.supplierOrderId, ...payload }
        ),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not update.');
      /*
       * Shown rather than swallowed: neither action moves money or reaches the
       * supplier, and the merchant has to do that part by hand.
       */
      if (Array.isArray(body?.warnings) && body.warnings.length) {
        setWarnings(body.warnings as string[]);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const onCancelSupplier = () => {
    const reason = window.prompt('Why is this supplier purchase being cancelled?');
    if (!reason?.trim()) return;
    act('cancel', { reason: reason.trim() });
  };

  const onRefund = () => {
    const reason = window.prompt(
      'Reason for the refund? (This records it in the books — issue the money in Flutterwave or PayPal.)'
    );
    if (!reason?.trim()) return;
    act('refund', { reason: reason.trim() });
  };

  const onPlace = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const externalOrderNo = String(data.get('externalOrderNo') ?? '').trim();
    if (!externalOrderNo) return setError('Enter the order number the supplier gave you.');
    act('place', { externalOrderNo });
  };

  const onShip = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const trackingNumber = String(data.get('trackingNumber') ?? '').trim();
    if (!trackingNumber) return setError('Enter the tracking number.');
    act('ship', { trackingNumber, carrier: String(data.get('carrier') ?? '') });
  };

  return (
    <article className="card space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Order #{sheet.orderNumber}</span>
          <span className="tag">{sheet.platform}</span>
          <span className="tag">{sheet.supplierName}</span>
          <span
            className={`tag ${sheet.status === 'PENDING' ? 'border-warn/50 text-warn' : 'border-verdigris/50 text-verdigris'}`}
          >
            {sheet.status}
          </span>
        </div>
        <span className="text-sm text-greige">
          Cost: {formatMoney(sheet.estimatedCostMinor, sheet.currency)}
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="field-label">Buy these</h3>
          {sheet.lines.map((line, i) => (
            <div key={i} className="rounded-sm border border-rule bg-bone2 p-4 text-sm">
              {/*
                Picture first. This card is read while buying from the supplier,
                and matching a colour by eye is far more reliable than matching
                an option label like "1PCS" or "Option 3".
              */}
              <div className="flex items-start gap-3">
                {line.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-16 w-16 flex-none rounded border border-rule object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {line.title && (
                    <p className="line-clamp-2 text-onyx">{line.title}</p>
                  )}
                  <a
                    href={line.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 line-clamp-2 block break-all text-verdigris underline-offset-2 hover:underline"
                  >
                    {line.url}
                  </a>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-greige">Variant</dt>
                  <dd>{line.variant}</dd>
                </div>
                <div>
                  <dt className="text-greige">SKU</dt>
                  <dd className="break-all">{line.sku}</dd>
                </div>
                <div>
                  <dt className="text-greige">Qty</dt>
                  <dd className="font-bold">{line.quantity}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="label mb-0">Ship directly to</h3>
            <button type="button" onClick={copy} className="btn btn-secondary px-3 py-1.5 text-xs">
              {copied ? 'Copied ✓' : 'Copy order sheet'}
            </button>
          </div>
          <address className="rounded-sm border border-rule bg-bone2 p-4 text-sm not-italic leading-relaxed">
            {sheet.shipTo.name}
            <br />
            {sheet.shipTo.line1}
            <br />
            {sheet.shipTo.line2 && (
              <>
                {sheet.shipTo.line2}
                <br />
              </>
            )}
            {[sheet.shipTo.city, sheet.shipTo.state].filter(Boolean).join(', ')}
            <br />
            {[sheet.shipTo.postcode, sheet.shipTo.country].filter(Boolean).join(' ')}
            {sheet.shipTo.phone && (
              <>
                <br />
                Tel: {sheet.shipTo.phone}
              </>
            )}
          </address>
          <p className="text-[11px] text-greige">
            Always ask the supplier to ship with no invoice or price tag in the parcel.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 border-t border-rule pt-5 sm:grid-cols-2">
        <form onSubmit={onPlace} className="flex gap-2">
          <input
            name="externalOrderNo"
            className="field"
            placeholder="Supplier order number"
            aria-label="Supplier order number"
          />
          <button type="submit" disabled={busy} className="btn btn-secondary shrink-0">
            Mark placed
          </button>
        </form>

        <form onSubmit={onShip} className="flex gap-2">
          <input
            name="trackingNumber"
            className="field"
            placeholder="Tracking number"
            aria-label="Tracking number"
          />
          <input name="carrier" className="field w-28" placeholder="Carrier" aria-label="Carrier" />
          <button type="submit" disabled={busy} className="btn btn-primary shrink-0">
            Shipped
          </button>
        </form>

        {/*
          The two ways an order ends without a parcel. Kept visually quieter
          than Placed/Shipped — they are the exception, and neither should be
          a click away from the happy path.
        */}
        {sheet.status !== 'CANCELLED' && (
          <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-3">
            <button
              type="button"
              onClick={onCancelSupplier}
              disabled={busy}
              className="text-micro text-greige transition-colors hover:text-warn disabled:opacity-50"
            >
              Cancel this supplier order
            </button>
            <button
              type="button"
              onClick={onRefund}
              disabled={busy}
              className="text-micro text-greige transition-colors hover:text-warn disabled:opacity-50"
            >
              Mark customer refunded
            </button>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="border border-warn/40 bg-warn/5 p-3">
            {warnings.map((w) => (
              <p key={w} className="text-micro text-warn">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
