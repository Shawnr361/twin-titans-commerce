'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export function ImportWizard({
  baseCurrency,
  defaultMarginPct,
}: {
  baseCurrency: string;
  defaultMarginPct: number;
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [marginPct, setMarginPct] = useState(defaultMarginPct);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [title, setTitle] = useState('');
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ handle: string; warnings: string[] } | null>(null);

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

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'commit', preview, title, priceOverrides }),
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

  const lossMaking = preview?.pricing.some((p) => p.profitMinor <= 0) ?? false;

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 p-6">
        <div>
          <label className="label" htmlFor="supplier-url">
            Supplier product URL
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="supplier-url"
              className="input flex-1"
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
              className="btn-primary sm:w-40"
            >
              {busy ? 'Reading…' : 'Fetch listing'}
            </button>
          </div>
          <p className="mt-2 text-xs text-mut">
            AliExpress, Alibaba and 1688 links are all understood, including short share links.
          </p>
        </div>

        <div className="max-w-xs">
          <label className="label" htmlFor="margin">
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
        <div role="alert" className="panel border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {saved && (
        <div className="panel border-accent/40 bg-accent/10 p-5 text-sm">
          <p className="font-semibold text-ink">
            Saved as a draft: <code className="text-accent2">{saved.handle}</code>
          </p>
          <p className="mt-1 text-mut">
            It is not live yet. Review it under Products, then publish when you are happy.
          </p>
          {saved.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-300">
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
            <div className="panel border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              You already imported this listing as{' '}
              <strong>{preview.alreadyImported.title}</strong>. Importing again creates a duplicate.
            </div>
          )}

          {preview.product.provenance === 'manual' && (
            <div className="panel border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <p className="font-semibold">The supplier blocked the automated read.</p>
              <ul className="mt-2 space-y-1 text-xs">
                {preview.product.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-accent/40 text-accent2">{preview.product.platform}</span>
              <span className="chip">Read from: {preview.product.provenance}</span>
              {preview.product.supplierName && (
                <span className="chip">{preview.product.supplierName}</span>
              )}
              {preview.product.rating != null && (
                <span className="chip">★ {preview.product.rating}</span>
              )}
              {preview.product.ordersCount != null && (
                <span className="chip">{preview.product.ordersCount.toLocaleString()} sold</span>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
              <div className="aspect-square overflow-hidden rounded-xl bg-black/40">
                {preview.product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.product.images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-mut">No image</div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="product-title">
                    Product title (rewrite this — supplier titles are keyword spam)
                  </label>
                  <textarea
                    id="product-title"
                    rows={2}
                    className="input resize-none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <p className="text-xs text-mut">
                  {preview.product.images.length} image(s) · costs in {preview.product.currency} ·
                  converted at {preview.fxRateUsed.toFixed(2)} {baseCurrency} per{' '}
                  {preview.product.currency}
                </p>
              </div>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h3 className="text-sm font-bold">
                Pricing — {preview.pricing.length} variant
                {preview.pricing.length === 1 ? '' : 's'}
              </h3>
              {lossMaking && (
                <span className="chip border-red-500/50 text-red-300">Loss-making variants</span>
              )}
            </div>

            <div className="scroll-x">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mut">
                    <th className="p-4 font-medium">Variant</th>
                    <th className="p-4 font-medium">Landed cost</th>
                    <th className="p-4 font-medium">Your price</th>
                    <th className="p-4 font-medium">Profit</th>
                    <th className="p-4 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.pricing.map((row, i) => {
                    const loss = row.profitMinor <= 0;
                    return (
                      <tr key={i} className="border-b border-line/60 last:border-0">
                        <td className="p-4">
                          <span className="font-medium">{row.optionLabel}</span>
                          {row.warnings.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-amber-400">
                              {row.warnings.map((w, j) => (
                                <li key={j}>{w}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="p-4 text-mut">
                          {formatMoney(row.landedCostMinor, baseCurrency)}
                        </td>
                        <td className="p-4">
                          <input
                            className="input w-32 py-2"
                            inputMode="decimal"
                            value={overrides[i] ?? String(fromMinor(row.priceMinor, baseCurrency))}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                            aria-label={`Price for ${row.optionLabel}`}
                          />
                        </td>
                        <td className={`p-4 font-semibold ${loss ? 'text-red-400' : 'text-ink'}`}>
                          {formatMoney(row.profitMinor, baseCurrency)}
                        </td>
                        <td className={`p-4 ${loss ? 'text-red-400' : 'text-accent2'}`}>
                          {row.marginPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={commit} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save as draft product'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="btn-ghost">
              Discard
            </button>
            <p className="text-xs text-mut">
              Imports always land as drafts — nothing goes live until you publish it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
