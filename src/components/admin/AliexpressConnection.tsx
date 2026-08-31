'use client';

import { useState } from 'react';

/**
 * Connect the store to AliExpress, and prove the connection works.
 *
 * The test is a READ, deliberately. The obvious way to prove dropshipping
 * works is to place an order — but that spends real money and ships real
 * goods, which is not how you discover a signing bug.
 */
export function AliexpressConnection({
  configured,
  connectedAt,
  sellerId,
  notice,
}: {
  configured: boolean;
  connectedAt: string | null;
  sellerId: string | null;
  notice: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const test = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/suppliers/aliexpress/connect', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      setResult({ ok: Boolean(body?.ok), detail: String(body?.detail ?? body?.error ?? '') });
    } catch {
      setResult({ ok: false, detail: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">AliExpress</h3>
        <p className="mt-1 text-sm text-greige">
          Connect the store so supplier orders, tracking and product data can be handled
          automatically instead of by hand.
        </p>
      </div>

      {notice && (
        <p className="border border-rule bg-paper-2 p-3 text-xs text-greige">{notice}</p>
      )}

      {!configured ? (
        <p className="text-xs text-warn">
          ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET are not set on the server yet.
        </p>
      ) : connectedAt ? (
        <p className="text-xs text-verdigris">
          Connected {new Date(connectedAt).toLocaleString()}
          {sellerId ? ` · seller ${sellerId}` : ''}
        </p>
      ) : (
        <p className="text-xs text-greige">Not connected yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/*
          A plain link, not fetch(): this leaves our site for AliExpress's
          consent screen, so it has to be a real navigation.
        */}
        <a
          href="/api/suppliers/aliexpress/connect"
          className={`btn btn-primary !rounded-full px-6 ${configured ? '' : 'pointer-events-none opacity-40'}`}
        >
          {connectedAt ? 'Reconnect' : 'Connect AliExpress'}
        </a>

        <button
          type="button"
          onClick={test}
          disabled={busy || !configured || !connectedAt}
          className="btn !rounded-full px-6 disabled:opacity-40"
        >
          {busy ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      {result && (
        <div
          className={`border p-3 text-xs ${
            result.ok ? 'border-verdigris/40 text-verdigris' : 'border-warn/40 text-warn'
          }`}
        >
          <p className="font-semibold">{result.ok ? 'Working.' : 'Not working yet.'}</p>
          {/*
            The gateway's raw answer, not a summary. A signature mistake and an
            expired token are only distinguishable from its exact wording, and
            hiding that turns a five-minute fix into guesswork.
          */}
          <p className="mt-1 break-all font-mono">{result.detail}</p>
        </div>
      )}
    </section>
  );
}
