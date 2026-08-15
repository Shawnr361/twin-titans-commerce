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
      <fieldset className="panel space-y-4 p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-mut">Store</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="storeName">
              Store name
            </label>
            <input id="storeName" name="storeName" className="input" defaultValue={settings.storeName} />
          </div>
          <div>
            <label className="label" htmlFor="tagline">
              Tagline
            </label>
            <input id="tagline" name="tagline" className="input" defaultValue={settings.tagline} />
          </div>
          <div>
            <label className="label" htmlFor="supportEmail">
              Support email
            </label>
            <input
              id="supportEmail"
              name="supportEmail"
              type="email"
              className="input"
              defaultValue={settings.supportEmail}
            />
          </div>
          <div>
            <label className="label" htmlFor="supportPhone">
              Support phone
            </label>
            <input
              id="supportPhone"
              name="supportPhone"
              className="input"
              defaultValue={settings.supportPhone}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="announcement">
            Announcement bar
          </label>
          <input
            id="announcement"
            name="announcement"
            className="input"
            defaultValue={settings.announcement}
          />
        </div>
      </fieldset>

      <fieldset className="panel space-y-4 p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-mut">
          Pricing defaults
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="marginPct">
              Target margin %
            </label>
            <input
              id="marginPct"
              name="marginPct"
              type="number"
              min={0}
              max={95}
              className="input"
              defaultValue={rules.marginPct}
            />
          </div>
          <div>
            <label className="label" htmlFor="minMarginPct">
              Minimum margin % (hard floor)
            </label>
            <input
              id="minMarginPct"
              name="minMarginPct"
              type="number"
              min={0}
              max={95}
              className="input"
              defaultValue={rules.minMarginPct}
            />
            <p className="mt-1 text-[11px] text-mut">
              Imports are never priced below this, and products with a below-cost variant cannot be
              published at all.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="panel space-y-4 p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-mut">
          Exchange rates
        </legend>
        <p className="text-xs text-mut">
          Units of the foreign currency per 1 {settings.baseCurrency}. Used for display conversion
          and for costing supplier prices back into {settings.baseCurrency}.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {(['USD', 'GBP', 'EUR'] as const).map((code) => (
            <div key={code}>
              <label className="label" htmlFor={`rate${code}`}>
                {code}
              </label>
              <input
                id={`rate${code}`}
                name={`rate${code}`}
                type="number"
                step="0.0000001"
                className="input"
                defaultValue={rates[code] ?? 0}
              />
              <p className="mt-1 text-[11px] text-mut">
                ≈ {rates[code] ? (1 / rates[code]).toFixed(2) : '—'} {settings.baseCurrency} per{' '}
                {code}
              </p>
            </div>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent2">{message}</p>
      )}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
