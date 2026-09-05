'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TrackingSettings } from '@/lib/tracking';

/**
 * Ad pixel + Conversions API configuration.
 *
 * A separate card from the main SettingsForm on purpose: these values come
 * from two external dashboards, are pasted rarely, and half of them are
 * secrets. Mixing them into the store-identity form would mean a token
 * round-tripping through the browser every time somebody edits the tagline.
 *
 * The tokens are write-only here. The server sends back whether each one is
 * set, never the value, so an admin session that leaks cannot hand over an
 * access token that can spend against the ad account's data.
 */
export function TrackingSettingsCard({
  settings,
  metaTokenSet,
  tiktokTokenSet,
}: {
  settings: Omit<TrackingSettings, 'metaCapiToken' | 'tiktokEventsToken'>;
  metaTokenSet: boolean;
  tiktokTokenSet: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch('/api/admin/tracking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          metaPixelId: String(form.get('metaPixelId') ?? '').trim(),
          tiktokPixelId: String(form.get('tiktokPixelId') ?? '').trim(),
          metaTestEventCode: String(form.get('metaTestEventCode') ?? '').trim(),
          tiktokTestEventCode: String(form.get('tiktokTestEventCode') ?? '').trim(),
          /*
           * Empty means "leave the stored token alone", not "clear it" —
           * otherwise saving a pixel id would silently wipe the token and the
           * server-side half would stop, invisibly. Clearing is explicit.
           */
          metaCapiToken: String(form.get('metaCapiToken') ?? ''),
          tiktokEventsToken: String(form.get('tiktokEventsToken') ?? ''),
          clearMetaToken: form.get('clearMetaToken') === 'on',
          clearTiktokToken: form.get('clearTiktokToken') === 'on',
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not save.');
      setMessage('Saved. Live on the next page load — no deploy needed.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="card space-y-4 p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-greige">
          Ad tracking
        </legend>

        <p className="text-micro text-greige">
          Pixel ids are public and appear in the page source. The access tokens are secret and
          are never sent back to this page — they power the server-side half, which is what
          keeps conversions reporting when a shopper blocks scripts or closes the tab on the
          bank redirect. Both halves send the same event id, so a purchase counts once.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="metaPixelId">
              Meta pixel ID
            </label>
            <input
              id="metaPixelId"
              name="metaPixelId"
              className="field"
              placeholder="1234567890123456"
              defaultValue={settings.metaPixelId}
            />
            <p className="mt-1 text-micro text-greige">
              Events Manager → Data sources. Leave empty to serve no Meta pixel at all.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="tiktokPixelId">
              TikTok pixel ID
            </label>
            <input
              id="tiktokPixelId"
              name="tiktokPixelId"
              className="field"
              placeholder="C1A2B3C4D5E6F7G8H9I0"
              defaultValue={settings.tiktokPixelId}
            />
            <p className="mt-1 text-micro text-greige">
              TikTok Ads Manager → Assets → Events → Web events.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="metaCapiToken">
              Meta Conversions API token{' '}
              <span className="text-greige">{metaTokenSet ? '(set)' : '(not set)'}</span>
            </label>
            <input
              id="metaCapiToken"
              name="metaCapiToken"
              type="password"
              autoComplete="off"
              className="field"
              placeholder={metaTokenSet ? 'Leave empty to keep the stored token' : 'EAAG…'}
            />
            <label className="mt-2 flex items-center gap-2 text-micro text-greige">
              <input type="checkbox" name="clearMetaToken" /> Clear the stored token
            </label>
          </div>

          <div>
            <label className="field-label" htmlFor="tiktokEventsToken">
              TikTok Events API token{' '}
              <span className="text-greige">{tiktokTokenSet ? '(set)' : '(not set)'}</span>
            </label>
            <input
              id="tiktokEventsToken"
              name="tiktokEventsToken"
              type="password"
              autoComplete="off"
              className="field"
              placeholder={tiktokTokenSet ? 'Leave empty to keep the stored token' : 'Access token'}
            />
            <label className="mt-2 flex items-center gap-2 text-micro text-greige">
              <input type="checkbox" name="clearTiktokToken" /> Clear the stored token
            </label>
          </div>

          <div>
            <label className="field-label" htmlFor="metaTestEventCode">
              Meta test event code
            </label>
            <input
              id="metaTestEventCode"
              name="metaTestEventCode"
              className="field"
              placeholder="TEST12345"
              defaultValue={settings.metaTestEventCode}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="tiktokTestEventCode">
              TikTok test event code
            </label>
            <input
              id="tiktokTestEventCode"
              name="tiktokTestEventCode"
              className="field"
              defaultValue={settings.tiktokTestEventCode}
            />
          </div>
        </div>

        <p className="text-micro text-warn">
          Clear both test codes once you have verified. Events sent with a test code are
          diagnostic only — they never count toward optimisation or reporting, so leaving one
          set means the campaign is spending against nothing.
        </p>

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Saving…' : 'Save tracking'}
          </button>
          {message && <span className="text-micro text-onyx">{message}</span>}
          {error && (
            <span role="alert" className="text-micro text-danger">
              {error}
            </span>
          )}
        </div>

        <p className="text-micro text-greige">
          Product feed for Meta Commerce Manager and TikTok Catalog:{' '}
          <a className="link" href="/api/feed/products.csv">
            /api/feed/products.csv
          </a>
        </p>
      </fieldset>
    </form>
  );
}
