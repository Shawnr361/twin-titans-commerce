'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconCheck, IconClose } from '@/components/icons';

/**
 * Paste a capture that the bookmarklet could not send directly.
 *
 * Supplier sites set a Content-Security-Policy whose `connect-src` blocks
 * requests to our domain, and a bookmarklet runs inside the page so it
 * inherits that policy. The clipboard is not governed by CSP, so the script
 * copies its payload instead and it is pasted here.
 *
 * This posts with the admin session rather than the capture token — it is
 * same-origin, so there is no preflight and nothing to block.
 */
export function CapturePaste() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const submit = async () => {
    const text = value.trim();
    if (!text) return;

    setBusy(true);
    setResult(null);
    try {
      // Fail on malformed JSON here, with a clear message, rather than
      // sending rubbish to the server and getting a generic 400 back.
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('That is not valid JSON. Copy the whole clipboard contents.');
      }

      const res = await fetch('/api/admin/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Rejected (${res.status}).`);

      setResult({
        ok: true,
        message: `Saved: ${body.variantCount ?? 0} variants (${body.pricedVariantCount ?? 0} priced), ${body.imageCount ?? 0} images, ${body.videoCount ?? 0} videos.`,
      });
      setValue('');
      router.refresh();
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6">
      <h3 className="font-display text-d2 text-onyx">Paste a capture</h3>
      <p className="mt-2 max-w-2xl text-body text-greige">
        If the bookmarklet says the site blocked sending, it copied the data to your clipboard
        instead. Paste it here.
      </p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        spellCheck={false}
        placeholder='{"sourceUrl":"https://www.aliexpress.com/item/...","variants":[...]}'
        className="field mt-4 resize-y font-mono text-micro"
        aria-label="Captured product JSON"
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="button" onClick={submit} disabled={busy || !value.trim()} className="btn btn-primary">
          {busy ? 'Saving…' : 'Save capture'}
        </button>
        {value && (
          <button type="button" onClick={() => { setValue(''); setResult(null); }} className="link text-label">
            Clear
          </button>
        )}
      </div>

      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={`mt-4 flex items-start gap-2 text-body ${result.ok ? 'text-verdigris' : 'text-danger'}`}
        >
          {result.ok ? <IconCheck size={16} className="mt-1 shrink-0" /> : <IconClose size={16} className="mt-1 shrink-0" />}
          {result.message}
        </p>
      )}
    </section>
  );
}
