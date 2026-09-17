'use client';

import { useState } from 'react';

interface Recipient {
  email: string;
  name: string | null;
}

type Result = { ok: boolean; text: string } | null;

/**
 * Write to a customer in the store's black-and-gold design.
 *
 * Preview first, test to yourself, then send — the same order anyone careful
 * would follow, made the path of least resistance. Sending asks for a
 * confirmation that names the address, because a sent email cannot be unsent.
 */
export function ComposeEmail({ customers, from }: { customers: Recipient[]; from: string }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [message, setMessage] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  const call = async (mode: 'preview' | 'test' | 'send') => {
    setBusy(mode);
    setResult(null);
    try {
      const res = await fetch('/api/admin/mail/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          to: to || undefined,
          subject,
          heading,
          message,
          ctaLabel: ctaLabel || undefined,
          ctaHref: ctaHref || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setResult({ ok: false, text: body.error ?? `HTTP ${res.status}` });
        return;
      }
      if (mode === 'preview') {
        setPreview(body.html);
      } else {
        setResult({
          ok: true,
          text:
            mode === 'test'
              ? `Test sent to ${body.sentTo}. Check that inbox before sending for real.`
              : `Sent to ${body.sentTo} from ${body.from}.`,
        });
        if (mode === 'send') setTo('');
      }
    } catch {
      setResult({ ok: false, text: 'Could not reach the store.' });
    } finally {
      setBusy(null);
    }
  };

  const send = () => {
    if (!to) {
      setResult({ ok: false, text: 'Enter the customer’s email address.' });
      return;
    }
    if (window.confirm(`Send “${subject}” to ${to}? This cannot be undone.`)) void call('send');
  };

  const ready = subject.trim() && heading.trim() && message.trim();

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block">
          <span className="field-label">To</span>
          <input
            type="email"
            list="customer-emails"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="customer@example.com"
            className="field w-full"
          />
          <datalist id="customer-emails">
            {customers.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name ?? ''}
              </option>
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="field-label">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="An update on your order"
            maxLength={150}
            className="field w-full"
          />
        </label>

        <label className="block">
          <span className="field-label">Heading</span>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Hello Ada, your parcel is on its way"
            maxLength={120}
            className="field w-full"
          />
        </label>

        <label className="block">
          <span className="field-label">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            maxLength={5000}
            placeholder={'Write as you would speak.\n\nLeave a blank line between paragraphs.'}
            className="field w-full"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Button text (optional)</span>
            <input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Track your order"
              maxLength={40}
              className="field w-full"
            />
          </label>
          <label className="block">
            <span className="field-label">Button link</span>
            <input
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              placeholder="https://twintitansemporium.store/orders/track"
              className="field w-full"
            />
          </label>
        </div>

        <p className="text-micro text-greige">
          Sent from {from}. Replies go to your support inbox.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => call('preview')}
            disabled={!ready || busy !== null}
            className="btn btn-secondary px-5 py-2 text-xs disabled:opacity-50"
          >
            {busy === 'preview' ? 'Rendering…' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => call('test')}
            disabled={!ready || busy !== null}
            className="btn btn-secondary px-5 py-2 text-xs disabled:opacity-50"
          >
            {busy === 'test' ? 'Sending…' : 'Send test to me'}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!ready || busy !== null}
            className="btn btn-primary px-5 py-2 text-xs disabled:opacity-50"
          >
            {busy === 'send' ? 'Sending…' : 'Send to customer'}
          </button>
        </div>

        {result && (
          <p role="status" className={`text-sm ${result.ok ? 'text-verdigris' : 'text-danger'}`}>
            {result.text}
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        {preview ? (
          <iframe
            title="Email preview"
            srcDoc={preview}
            sandbox=""
            className="h-[42rem] w-full border-0"
          />
        ) : (
          <div className="flex h-full min-h-[20rem] items-center justify-center p-8 text-center text-sm text-greige">
            Press Preview to see the email exactly as it will be sent.
          </div>
        )}
      </div>
    </div>
  );
}
