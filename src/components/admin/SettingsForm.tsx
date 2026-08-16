'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StoreSettings } from '@/lib/settings';
import type { PricingRules } from '@/lib/pricing';

export function SettingsForm({
  settings,
  rules,
  rates,
}: {
  settings: StoreSettings;
  rules: PricingRules;
  rates: Record<string, number>;
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
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          store: {
            storeName: String(form.get('storeName') ?? ''),
            tagline: String(form.get('tagline') ?? ''),
            supportEmail: String(form.get('supportEmail') ?? ''),
            supportPhone: String(form.get('supportPhone') ?? ''),
            announcement: String(form.get('announcement') ?? ''),
          },
          pricing: {
            marginPct: Number(form.get('marginPct')),
            minMarginPct: Number(form.get('minMarginPct')),
          },
          rates: {
            USD: Number(form.get('rateUSD')),
            GBP: Number(form.get('rateGBP')),
            EUR: Number(form.get('rateEUR')),
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not save.');
      setMessage('Saved.');
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
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-greige">Store</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="storeName">
              Store name
            </label>
            <input id="storeName" name="storeName" className="field" defaultValue={settings.storeName} />
          </div>
          <div>
            <label className="field-label" htmlFor="tagline">
              Tagline
            </label>
            <input id="tagline" name="tagline" className="field" defaultValue={settings.tagline} />
          </div>
          <div>
            <label className="field-label" htmlFor="supportEmail">
              Support email
            </label>
            <input
              id="supportEmail"
              name="supportEmail"
              type="email"
              className="field"
              defaultValue={settings.supportEmail}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="supportPhone">
              Support phone
            </label>
            <input
              id="supportPhone"
              name="supportPhone"
              className="field"
              defaultValue={settings.supportPhone}
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="announcement">
            Announcement bar
          </label>
          <input
            id="announcement"
            name="announcement"
            className="field"
            defaultValue={settings.announcement}
          />
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-greige">
          Pricing defaults
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="marginPct">
              Target margin %
            </label>
            <input
              id="marginPct"
              name="marginPct"
              type="number"
              min={0}
              max={95}
              className="field"
              defaultValue={rules.marginPct}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="minMarginPct">
              Minimum margin % (hard floor)
            </label>
            <input
              id="minMarginPct"
              name="minMarginPct"
              type="number"
              min={0}
              max={95}
              className="field"
              defaultValue={rules.minMarginPct}
            />
            <p className="mt-1 text-[11px] text-greige">
              Imports are never priced below this, and products with a below-cost variant cannot be
              published at all.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-greige">
          Exchange rates
        </legend>
        <p className="text-xs text-greige">
          Units of the foreign currency per 1 {settings.baseCurrency}. Used for display conversion
          and for costing supplier prices back into {settings.baseCurrency}.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {(['USD', 'GBP', 'EUR'] as const).map((code) => (
            <div key={code}>
              <label className="field-label" htmlFor={`rate${code}`}>
                {code}
              </label>
              <input
                id={`rate${code}`}
                name={`rate${code}`}
                type="number"
                step="0.0000001"
                className="field"
                defaultValue={rates[code] ?? 0}
              />
              <p className="mt-1 text-[11px] text-greige">
                ≈ {rates[code] ? (1 / rates[code]).toFixed(2) : '—'} {settings.baseCurrency} per{' '}
                {code}
              </p>
            </div>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-verdigris/10 p-3 text-sm text-verdigris">{message}</p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
