'use client';

import { useState } from 'react';

/**
 * "Did that sender actually work?" — answered in one press.
 *
 * Changing the address automatic emails come from is the one setting that can
 * silently stop EVERY order confirmation: the mail server refuses a sender it
 * cannot verify. After the domain rename in September the configured sender
 * pointed at a mailbox that had moved, and the only way to check was pasting
 * code into the browser console, which is not something a merchant should need
 * to do to find out whether customers are hearing from the shop.
 *
 * It tests the SAVED settings, because that is what orders use — so it says
 * "save first", rather than testing whatever happens to be typed in the box.
 *
 * "Accepted" is deliberately not reported as "delivered". The server can take a
 * message and still fail to deliver it, so success asks for a look in the inbox.
 */
export function MailTestButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/mail/test', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (body?.ok) {
        setResult({
          ok: true,
          text: `Sent from ${body.from} to ${body.sentTo}. Check that inbox (and spam) — if it arrived, order emails are working.`,
        });
      } else {
        setResult({
          ok: false,
          text: `Not sent${body?.from ? ` from ${body.from}` : ''}: ${body?.detail ?? body?.error ?? `HTTP ${res.status}`}. Order emails will fail until this is fixed — try leaving the box empty and saving.`,
        });
      }
    } catch {
      setResult({ ok: false, text: 'Could not reach the store to run the test.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="btn btn-secondary px-4 py-2 text-xs disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send test email'}
        </button>
        <span className="text-micro text-greige">Save first — this tests the saved address.</span>
      </div>
      {result && (
        <p
          role="status"
          className={`text-micro ${result.ok ? 'text-verdigris' : 'text-danger'}`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
