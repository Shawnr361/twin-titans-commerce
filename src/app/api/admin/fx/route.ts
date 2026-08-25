import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import {
  RATES_SNAPSHOT_DATE,
  getRates,
  getRatesAge,
  refreshRatesFromProvider,
} from '@/lib/fx';
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
  const result = await refreshRatesFromProvider(settings.baseCurrency);

  if (!result.ok) {
    return NextResponse.json(
      { error: `Could not refresh rates (${result.error ?? 'no usable rates'}). Rates unchanged.` },
      { status: 502 }
    );
  }

  const base = settings.baseCurrency.toUpperCase();
  return NextResponse.json({
    ok: true,
    base,
    providerUpdatedAt: result.providerUpdatedAt,
    updated: Object.fromEntries(
      Object.entries(result.updated).map(([code, perBase]) => [
        code,
        `1 ${code} = ${base} ${(1 / perBase).toFixed(2)}`,
      ])
    ),
    skipped: result.skipped,
  });
}
