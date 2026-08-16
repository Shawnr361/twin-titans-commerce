'use client';

import { useRouter } from 'next/navigation';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { formatMoney, fromMinor, toMinor } from '@/lib/money';

interface PricingRow {
  optionLabel: string;
  sourceCostMinor: number;
  landedCostMinor: number;
  priceMinor: number;
  compareAtMinor: number | null;
  profitMinor: number;
  marginPct: number;
  warnings: string[];
}

interface Preview {
  product: {
    platform: string;
    title: string;
    descriptionHtml: string;
    images: string[];
    currency: string;
    sourceUrl: string;
    supplierName?: string;
    rating?: number;
    reviewCount?: number;
    ordersCount?: number;
    provenance: 'api' | 'page' | 'manual';
    warnings: string[];
    variants: { options: Record<string, string> }[];
  };
  pricing: PricingRow[];
  baseCurrency: string;
  fxRateUsed: number;
  alreadyImported: { productId: string; handle: string; title: string } | null;
}

/** Lets the workspace hand a capture to the wizard without lifting its state. */
export interface ImportWizardHandle {
  loadCapture: (captureId: string) => void;
}

export const ImportWizard = forwardRef<
  ImportWizardHandle,
  { baseCurrency: string; defaultMarginPct: number; activeCaptureId?: string | null }
>(function ImportWizard({ baseCurrency, defaultMarginPct }, ref) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [marginPct, setMarginPct] = useState(defaultMarginPct);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [title, setTitle] = useState('');
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  /*
   * Landed cost, typed in by hand. Suppliers frequently serve an anti-bot page
   * that yields title and images but no price or SKU data, and a product whose
   * cost we do not know cannot be priced — every margin computed against a
   * zero cost is fiction.
   */
  const [costs, setCosts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ handle: string; warnings: string[] } | null>(null);

  /** Load a browser capture into the pricing table. */
  const loadCapture = useCallback(
    async (captureId: string) => {
      setBusy(true);
      setError(null);
      setSaved(null);
      try {
        const res = await fetch('/api/admin/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'preview-capture', captureId, marginPct }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? 'Could not load that capture.');
        setPreview(body);
        setTitle(body.product.title);
        setOverrides({});
        setCosts({});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load that capture.');
        setPreview(null);
      } finally {
        setBusy(false);
      }
    },
    [marginPct]
  );

  useImperativeHandle(ref, () => ({ loadCapture: (id: string) => void loadCapture(id) }), [
    loadCapture,
  ]);

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'preview', url, marginPct }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not read that listing.');
      setPreview(body);
      setTitle(body.product.title);
      setOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const priceOverrides: Record<string, number> = {};
      for (const [index, raw] of Object.entries(overrides)) {
        const value = parseFloat(raw);
        if (Number.isFinite(value) && value > 0) {
          priceOverrides[index] = toMinor(value, baseCurrency);
        }
      }

      const costOverrides: Record<string, number> = {};
      for (const [index, raw] of Object.entries(costs)) {
        const value = parseFloat(raw);
        if (Number.isFinite(value) && value > 0) {
          costOverrides[index] = toMinor(value, baseCurrency);
        }
      }

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'commit', preview, title, priceOverrides, costOverrides }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not save the product.');

      setSaved({ handle: body.handle, warnings: body.warnings ?? [] });
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  /** Effective cost for a row: what was typed, else what the supplier gave. */
  const costFor = (row: PricingRow, i: number): number => {
    const typed = parseFloat(costs[i] ?? '');
    return Number.isFinite(typed) && typed > 0 ? toMinor(typed, baseCurrency) : row.landedCostMinor;
  };

  /** Effective price for a row: what was typed, else what the engine solved. */
  const priceFor = (row: PricingRow, i: number): number => {
    const typed = parseFloat(overrides[i] ?? '');
    return Number.isFinite(typed) && typed > 0 ? toMinor(typed, baseCurrency) : row.priceMinor;
  };

  const rows = preview?.pricing ?? [];

  // Recomputed live from whatever is in the inputs, so the numbers on screen
  // always describe what would actually be saved.
  const computed = rows.map((row, i) => {
    const cost = costFor(row, i);
    const price = priceFor(row, i);
    const known = cost > 0;
    return {
      cost,
      price,
      known,
      profit: known ? price - cost : 0,
      margin: known && price > 0 ? ((price - cost) / price) * 100 : 0,
      loss: known && price - cost <= 0,
    };
  });

  const missingCost = computed.some((c) => !c.known);
  const lossMaking = computed.some((c) => c.loss);
  /* Saving is refused while any cost is unknown — the whole point of the
     pricing engine is that it can prove a price clears its cost. */
  const blocked = missingCost || lossMaking;

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <div>
          <label className="field-label" htmlFor="supplier-url">
            Supplier product URL
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="supplier-url"
              className="field flex-1"
              placeholder="https://www.aliexpress.com/item/1005007635123586.html"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) runPreview();
              }}
            />
            <button
              type="button"
              onClick={runPreview}
              disabled={busy || !url.trim()}
              className="btn btn-primary sm:w-40"
            >
              {busy ? 'Reading…' : 'Fetch listing'}
            </button>
          </div>
          <p className="mt-2 text-xs text-greige">
            AliExpress, Alibaba and 1688 links are all understood, including short share links.
          </p>
        </div>

        <div className="max-w-xs">
          <label className="field-label" htmlFor="margin">
            Target margin: {marginPct}%
          </label>
          <input
            id="margin"
            type="range"
            min={10}
            max={80}
            value={marginPct}
            onChange={(e) => setMarginPct(Number(e.target.value))}
            className="w-full accent-[rgb(124,92,255)]"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="card border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {saved && (
        <div className="card border-verdigris/40 bg-verdigris/10 p-5 text-sm">
          <p className="font-semibold text-onyx">
            Saved as a draft: <code className="text-verdigris">{saved.handle}</code>
          </p>
          <p className="mt-1 text-greige">
            It is not live yet. Review it under Products, then publish when you are happy.
          </p>
          {saved.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-warn">
              {saved.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-5">
          {preview.alreadyImported && (
            <div className="card border-warn/40 bg-warn/10 p-4 text-sm text-warn">
              You already imported this listing as{' '}
              <strong>{preview.alreadyImported.title}</strong>. Importing again creates a duplicate.
            </div>
          )}

          {preview.product.provenance === 'manual' && (
            <div className="card border-warn/40 bg-warn/10 p-4 text-sm text-warn">
              <p className="font-semibold">The supplier blocked the automated read.</p>
              <ul className="mt-2 space-y-1 text-xs">
                {preview.product.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag border-verdigris/40 text-verdigris">{preview.product.platform}</span>
              <span className="tag">Read from: {preview.product.provenance}</span>
              {preview.product.supplierName && (
                <span className="tag">{preview.product.supplierName}</span>
              )}
              {preview.product.rating != null && (
                <span className="tag">★ {preview.product.rating}</span>
              )}
              {preview.product.ordersCount != null && (
                <span className="tag">{preview.product.ordersCount.toLocaleString()} sold</span>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
              <div className="aspect-square overflow-hidden rounded-sm bg-bone2">
                {preview.product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.product.images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-greige">No image</div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="field-label" htmlFor="product-title">
                    Product title (rewrite this — supplier titles are keyword spam)
                  </label>
                  <textarea
                    id="product-title"
                    rows={2}
                    className="field resize-none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <p className="text-xs text-greige">
                  {preview.product.images.length} image(s) · costs in {preview.product.currency} ·
                  converted at {preview.fxRateUsed.toFixed(2)} {baseCurrency} per{' '}
                  {preview.product.currency}
                </p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-rule p-5">
              <h3 className="text-sm font-bold">
                Pricing — {preview.pricing.length} variant
                {preview.pricing.length === 1 ? '' : 's'}
              </h3>
              {lossMaking && (
                <span className="tag border-danger/50 text-danger">Loss-making variants</span>
              )}
            </div>

            <div className="scroll-x">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-greige">
                    <th className="p-4 font-medium">Variant</th>
                    <th className="p-4 font-medium">Landed cost</th>
                    <th className="p-4 font-medium">Your price</th>
                    <th className="p-4 font-medium">Profit</th>
                    <th className="p-4 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.pricing.map((row, i) => {
                    const c = computed[i];
                    const loss = c.loss;
                    return (
                      <tr key={i} className="border-b border-rule/60 last:border-0">
                        <td className="p-4">
                          <span className="font-medium">{row.optionLabel}</span>
                          {row.warnings.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-warn">
                              {row.warnings.map((w, j) => (
                                <li key={j}>{w}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="p-4">
                          <input
                            className={`field w-32 py-2 ${!c.known ? 'border-danger' : ''}`}
                            inputMode="decimal"
                            placeholder="required"
                            value={
                              costs[i] ??
                              (row.landedCostMinor > 0
                                ? String(fromMinor(row.landedCostMinor, baseCurrency))
                                : '')
                            }
                            onChange={(e) => setCosts((prev) => ({ ...prev, [i]: e.target.value }))}
                            aria-label={`Landed cost for ${row.optionLabel}`}
                          />
                          {!c.known && (
                            <span className="mt-1 block text-[11px] text-danger">
                              Enter what this costs you
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <input
                            className="field w-32 py-2"
                            inputMode="decimal"
                            value={overrides[i] ?? String(fromMinor(row.priceMinor, baseCurrency))}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                            aria-label={`Price for ${row.optionLabel}`}
                          />
                        </td>
                        {/*
                          With no cost, profit and margin are arithmetic against
                          zero — a 98.5% margin that means nothing. Show a dash
                          rather than a number that flatters.
                        */}
                        <td className={`p-4 font-semibold ${loss ? 'text-danger' : 'text-onyx'}`}>
                          {c.known ? formatMoney(c.profit, baseCurrency) : '—'}
                        </td>
                        <td className={`p-4 ${loss ? 'text-danger' : 'text-verdigris'}`}>
                          {c.known ? `${c.margin.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={commit}
              disabled={busy || blocked}
              title={
                missingCost
                  ? 'Enter the landed cost for every variant first'
                  : lossMaking
                    ? 'A variant would sell at or below cost'
                    : undefined
              }
              className="btn btn-primary"
            >
              {busy ? 'Saving…' : 'Save as draft product'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="btn btn-secondary">
              Discard
            </button>
            <p className="text-xs text-greige">
              {missingCost
                ? 'Enter the landed cost for every variant — a product cannot be priced without it.'
                : lossMaking
                  ? 'At least one variant would sell at or below cost. Fix the price or the cost.'
                  : 'Imports always land as drafts — nothing goes live until you publish it.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
