'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Paste a link, get a capture.
 *
 * The whole point is that it needs nothing installed: no bookmarklet, no
 * extension, no visiting the supplier page at all. The server asks the
 * AliExpress API and stores the result exactly as a browser capture, so what
 * appears below is the queue that was always there.
 *
 * It stops at a capture rather than creating the product, because pricing stays
 * a decision a person makes.
 */
export function ImportFromUrl({ captureToken }: { captureToken?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; warning?: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/import/from-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setResult({ ok: false, text: String(body.error ?? 'Could not fetch that product.') });
      } else {
        const q = body.quality;
        setResult({
          ok: true,
          text: `Fetched "${String(body.title).slice(0, 60)}" — ${q.variantCount} variants (${q.pricedVariantCount} priced), ${q.imageCount} images. It is in the queue below.`,
          warning: body.warning,
        });
        setUrl('');
        router.refresh();
      }
    } catch {
      setResult({ ok: false, text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-6">
      <div>
        <label className="field-label" htmlFor="import-url">
          Import from a link
        </label>
        <p className="mb-2 text-micro text-greige">
          Paste an AliExpress product link (or just its number). Nothing to install — the
          store asks AliExpress directly, so prices and options come from the source.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            id="import-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.aliexpress.com/item/1005005457763997.html"
            className="field min-w-[16rem] flex-1"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="btn btn-primary !rounded-full px-5 py-2 text-xs disabled:opacity-60"
          >
            {busy ? 'Fetching…' : 'Fetch product'}
          </button>
        </div>
      </div>

      {captureToken && (
        <details className="border-t border-rule pt-3">
          <summary className="cursor-pointer text-micro text-greige">
            Browser extension — one-click from AliExpress
          </summary>
          <p className="mt-2 text-micro text-greige">
            Paste this into the extension&rsquo;s options, with the store address. It is the same
            token the bookmarklet uses; it lets a request add a capture and nothing else.
          </p>
          <code className="mt-2 block break-all border border-rule p-2 text-micro text-onyx">
            {captureToken}
          </code>
        </details>
      )}

      {result && (
        <div className="space-y-1">
          <p className={`text-micro ${result.ok ? 'text-verdigris' : 'text-warn'}`}>{result.text}</p>
          {/* A duplicate is the one thing that changes what to do next, so it is
              coloured as a warning even when the fetch itself succeeded. */}
          {result.warning && <p className="text-micro text-warn">{result.warning}</p>}
        </div>
      )}
    </form>
  );
}
