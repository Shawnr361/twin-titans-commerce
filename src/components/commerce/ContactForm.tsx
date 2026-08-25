'use client';

import { useState } from 'react';

/**
 * The contact form.
 *
 * The support address is always rendered alongside it, not only when something
 * breaks: a customer with a problem should never have to discover that the form
 * is their single route to a human. If delivery fails, the error carries the
 * address again rather than a bare "something went wrong".
 */
export function ContactForm({ supportEmail }: { supportEmail: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState('sending');

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          email: String(data.get('email') ?? ''),
          orderNumber: String(data.get('orderNumber') ?? '') || undefined,
          message: String(data.get('message') ?? ''),
          website: String(data.get('website') ?? ''),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(body.error ?? 'We could not send that. Please try again.');
        setState('idle');
        return;
      }

      form.reset();
      setState('sent');
    } catch {
      setError(`We could not reach the server. Please email us at ${supportEmail}.`);
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div className="glass-panel p-8">
        <p className="font-display text-d2">Thank you — that reached us.</p>
        <p className="mt-3 text-body text-greige">
          We reply to every message, usually within one business day. If it is urgent, write to{' '}
          <a className="underline underline-offset-2" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          .
        </p>
        <button type="button" className="btn btn-secondary mt-6" onClick={() => setState('idle')}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass-panel space-y-5 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="contact-name">
            Your name
          </label>
          <input id="contact-name" name="name" required maxLength={120} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="contact-email">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            className="field"
            placeholder="so we can reply"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="contact-order">
          Order number <span className="text-quiet">(optional)</span>
        </label>
        <input
          id="contact-order"
          name="orderNumber"
          maxLength={40}
          className="field"
          placeholder="e.g. 1024 — it gets you an answer much faster"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="contact-message">
          How can we help?
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          className="field resize-none"
        />
      </div>

      {/* Honeypot: off-screen and hidden from assistive tech, so only a bot fills it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Leave this empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="text-body text-warn">
          {error}
        </p>
      )}

      <button type="submit" disabled={state === 'sending'} className="btn btn-primary sheen w-full">
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>

      <p className="text-micro text-greige">
        Prefer email? Write to{' '}
        <a className="underline underline-offset-2" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        .
      </p>
    </form>
  );
}
