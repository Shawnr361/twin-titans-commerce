'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMoney } from '@/lib/money';

interface Sheet {
  supplierOrderId: string;
  supplierName: string;
  platform: string;
  orderNumber: number;
  status: string;
  lines: { url: string; sku: string; variant: string; quantity: number }[];
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sheet.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was blocked — select the text below and copy it manually.');
    }
  };

  const act = async (action: 'place' | 'ship', payload: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/fulfilment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, supplierOrderId: sheet.supplierOrderId, ...payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not update.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
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
    <article className="panel space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Order #{sheet.orderNumber}</span>
          <span className="chip">{sheet.platform}</span>
          <span className="chip">{sheet.supplierName}</span>
          <span
            className={`chip ${sheet.status === 'PENDING' ? 'border-amber-500/50 text-amber-300' : 'border-accent/50 text-accent2'}`}
          >
            {sheet.status}
          </span>
        </div>
        <span className="text-sm text-mut">
          Cost: {formatMoney(sheet.estimatedCostMinor, sheet.currency)}
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="label">Buy these</h3>
          {sheet.lines.map((line, i) => (
            <div key={i} className="rounded-xl border border-line bg-black/20 p-4 text-sm">
              <a
                href={line.url}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 break-all text-accent2 underline-offset-2 hover:underline"
              >
                {line.url}
              </a>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-mut">Variant</dt>
                  <dd>{line.variant}</dd>
                </div>
                <div>
                  <dt className="text-mut">SKU</dt>
                  <dd className="break-all">{line.sku}</dd>
                </div>
                <div>
                  <dt className="text-mut">Qty</dt>
                  <dd className="font-bold">{line.quantity}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="label mb-0">Ship directly to</h3>
            <button type="button" onClick={copy} className="btn-ghost px-3 py-1.5 text-xs">
              {copied ? 'Copied ✓' : 'Copy order sheet'}
            </button>
          </div>
          <address className="rounded-xl border border-line bg-black/20 p-4 text-sm not-italic leading-relaxed">
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
          <p className="text-[11px] text-mut">
            Always ask the supplier to ship with no invoice or price tag in the parcel.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <form onSubmit={onPlace} className="flex gap-2">
          <input
            name="externalOrderNo"
            className="input"
            placeholder="Supplier order number"
            aria-label="Supplier order number"
          />
          <button type="submit" disabled={busy} className="btn-ghost shrink-0">
            Mark placed
          </button>
        </form>

        <form onSubmit={onShip} className="flex gap-2">
          <input
            name="trackingNumber"
            className="input"
            placeholder="Tracking number"
            aria-label="Tracking number"
          />
          <input name="carrier" className="input w-28" placeholder="Carrier" aria-label="Carrier" />
          <button type="submit" disabled={busy} className="btn-primary shrink-0">
            Shipped
          </button>
        </form>
      </div>
    </article>
  );
}
