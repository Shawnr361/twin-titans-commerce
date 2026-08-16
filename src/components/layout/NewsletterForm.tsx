'use client';

import { useState } from 'react';

/**
 * Newsletter capture.
 *
 * The endpoint does not exist yet, so this does not pretend to succeed —
 * per the "no placeholder buttons pretending to work" rule, it posts to the
 * real route and surfaces whatever comes back. Until §22's email service is
 * built, that route returns 501 and the customer is told plainly.
 */
export function NewsletterForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!email) return;

    setState('sending');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not sign you up just now.');
      setState('done');
      setMessage('Thank you — you are on the list.');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (state === 'done') {
    return (
      <p role="status" className="mt-6 text-body text-verdigris">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <label htmlFor="newsletter-email" className="label block">
        Private view
      </label>
      <p className="mt-2 text-body text-greige">
        New arrivals and closed sales, before they are public.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email address"
          className="field flex-1"
        />
        <button type="submit" disabled={state === 'sending'} className="btn btn-primary px-6">
          {state === 'sending' ? '…' : 'Join'}
        </button>
      </div>

      {state === 'error' && (
        <p role="alert" className="mt-3 text-label text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
