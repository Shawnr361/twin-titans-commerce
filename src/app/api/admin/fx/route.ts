import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { FALLBACK_RATES, RATES_SNAPSHOT_DATE, getRates, getRatesAge, upsertRate } from '@/lib/fx';
import { getStoreSettings } from '@/lib/settings';

/**
 * Refresh the stored exchange rates from a live source.
 *
 * Hardcoding rates only ever buys time — the set this replaced was invented and
 * had USD at 1/1500 against a real 1/1351, which is money lost on every PayPal
 * order. So the durable fix is a refresh anyone can run, not a better constant.
 *
 * Runs as a route rather than a script because node and npx cannot start on
 * this host: their worker threads count against the LVE process cap and abort
 * with uv_thread_create. Inside the Passenger worker there is no new process to
 * spawn, so this works where a script does not.
 *
 * Mid-market rates. The rate a Nigerian card is actually charged is worse, and
 * sourceCostToBase applies its own buy-side buffer when costing supplier
 * purchases for exactly that reason.
 */

const SUPPORTED = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'CNY', 'ZAR', 'GHS'] as const;

const SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
  CNY: '¥',
  ZAR: 'R',
  GHS: '₵',
  NGN: '₦',
};

async function guard() {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }
}

/** Current rates and how stale they are. */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const [rates, age, settings] = await Promise.all([getRates(), getRatesAge(), getStoreSettings()]);

  return NextResponse.json({
    base: settings.baseCurrency,
    usingFallback: age.usingFallback,
    fallbackSnapshotDate: RATES_SNAPSHOT_DATE,
    storedCount: age.count,
    oldestUpdatedAt: age.oldestUpdatedAt,
    daysOld: age.daysOld,
    stale: age.daysOld != null && age.daysOld > 7,
    rates: Object.fromEntries(
      Object.entries(rates).map(([code, perBase]) => [
        code,
        { perBase, oneUnitInBase: perBase > 0 ? Number((1 / perBase).toFixed(2)) : null },
      ])
    ),
  });
}

/** Fetch live mid-market rates and store them. */
export async function POST() {
  const denied = await guard();
  if (denied) return denied;

  const settings = await getStoreSettings();
  const base = settings.baseCurrency.toUpperCase();

  let payload: { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Rate provider returned ${res.status}. Rates unchanged.` },
        { status: 502 }
      );
    }
    payload = await res.json();
  } catch (err) {
    // Unchanged beats half-updated: a partial set is worse than a stale one.
    return NextResponse.json(
      { error: `Could not reach the rate provider (${(err as Error).message}). Rates unchanged.` },
      { status: 502 }
    );
  }

  const live = payload.rates ?? {};
  if (!live[base] && payload.result !== 'success') {
    return NextResponse.json({ error: 'Rate provider sent no usable rates.' }, { status: 502 });
  }

  const updated: Record<string, number> = {};
  const skipped: string[] = [];

  for (const code of SUPPORTED) {
    const perBase = live[code];
    /*
     * Sanity-check before storing. A provider returning 0, a negative, or an
     * absurd value would otherwise be written straight into pricing — and a bad
     * rate does not look wrong, it just quietly mischarges.
     */
    if (typeof perBase !== 'number' || !isFinite(perBase) || perBase <= 0) {
      skipped.push(code);
      continue;
    }
    const expected = FALLBACK_RATES[code];
    if (expected && (perBase > expected * 5 || perBase < expected / 5)) {
      skipped.push(`${code} (moved >5x from the known snapshot — refusing)`);
      continue;
    }
    await upsertRate(code, perBase, SYMBOLS[code] ?? '');
    updated[code] = perBase;
  }

  // The base itself is 1 by definition, and the switcher needs it present.
  await upsertRate(base, 1, SYMBOLS[base] ?? '');

  return NextResponse.json({
    ok: true,
    base,
    providerUpdatedAt: payload.time_last_update_utc ?? null,
    updated: Object.fromEntries(
      Object.entries(updated).map(([c, r]) => [c, `1 ${c} = ${base} ${(1 / r).toFixed(2)}`])
    ),
    skipped,
  });
}
