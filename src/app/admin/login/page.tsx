'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

/**
 * Only ever return a path on this site.
 *
 * `next` comes straight from the query string, and this value is handed to
 * window.location. Without this, /admin/login?next=https://example.com would
 * send someone who has just typed their password to another site — the classic
 * open redirect, and a convincing one because the login itself really worked.
 * A protocol-relative "//evil.com" is a URL too, so leading slashes are capped.
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/admin';
  return next;
}

function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Sign in failed.');

      /*
       * A full page load, not router.push.
       *
       * The session cookie is set by the response we just awaited. A
       * client-side RSC navigation can be served from the router cache and
       * race that cookie, so middleware sees no session and bounces straight
       * back to /admin/login. Nothing resets `busy` on the success path, so
       * the button sat on "Signing in…" for ever with no error to show —
       * which is exactly how this was reported. A real navigation always
       * carries the new cookie and lets middleware decide with it.
       */
      window.location.assign(safeNext(params.get('next')));
      // Deliberately leaves `busy` set: the page is on its way out, and
      // flicking back to "Sign in" first reads as a failure.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight">Store admin</h1>
        <p className="text-xs text-greige">Sign in to manage your store.</p>
      </div>

      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoFocus className="field" />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="field"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
