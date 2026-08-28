'use client';

import { useState } from 'react';

/**
 * The confirm step of unsubscribing.
 *
 * Exists so that removal happens on a deliberate click rather than on the page
 * being fetched — mail scanners open every link in a message automatically.
 */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const remove = async () => {
    setState('sending');
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not remove you just now.');
      setState('done');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (state === 'done') {
    return (
      <p role="status" className="mt-8 text-body text-verdigris">
        You have been removed. No further marketing emails will be sent.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={remove}
        disabled={state === 'sending'}
        className="btn btn-primary !rounded-full px-8 disabled:opacity-60"
      >
        {state === 'sending' ? 'Removing…' : 'Unsubscribe me'}
      </button>

      {state === 'error' && (
        <p role="alert" className="mt-3 text-label text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
