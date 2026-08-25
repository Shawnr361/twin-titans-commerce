import { NextResponse } from 'next/server';
import { getRatesAge, refreshRatesFromProvider } from '@/lib/fx';
import { getSession } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings';

/**
 * Scheduled exchange-rate refresh.
 *
 * WHY THIS IS A CRON ENDPOINT AND NOT A LAZY CHECK
 * ------------------------------------------------
 * The first attempt at "automatic" put the staleness check inside getRates(),
 * which runs in SiteHeader — so it was on the render path of every page. Next
 * patches fetch, so the outbound call was not the fire-and-forget it looked
 * like: renders waited on it and every page hung, while /api/admin/fx (which
 * never reached that line) still answered in 2.4s. It took the storefront down
 * and had to be rolled back.
 *
 * The lesson is narrow and worth keeping: never start network work on a render
 * path. A request handler is a safe place to await; a server component is not.
 *
 * Rates are only refreshed when they are actually old, so hitting this more
 * often than needed costs one cheap database read.
 */

export const dynamic = 'force-dynamic';

/** Refresh only if the stored set is older than this. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function authorise(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization') ?? '';
    const url = new URL(request.url);
    if (header === `Bearer ${secret}` || url.searchParams.get('key') === secret) return true;
  }
  // An admin hitting it by hand is always allowed, so it stays usable before
  // CRON_SECRET is configured.
  return Boolean(await getSession().catch(() => null));
}

async function run(request: Request) {
  if (!(await authorise(request))) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const age = await getRatesAge();
  const stale =
    age.usingFallback ||
    age.oldestUpdatedAt == null ||
    Date.now() - age.oldestUpdatedAt.getTime() > MAX_AGE_MS;

  if (!stale) {
    return NextResponse.json({ refreshed: false, reason: 'rates are current', daysOld: age.daysOld });
  }

  const settings = await getStoreSettings();
  const result = await refreshRatesFromProvider(settings.baseCurrency);

  return NextResponse.json(
    {
      refreshed: result.ok,
      updated: Object.keys(result.updated),
      skipped: result.skipped,
      providerUpdatedAt: result.providerUpdatedAt,
      error: result.error,
    },
    // A failed refresh leaves the previous rates in place, so this is a warning
    // rather than an outage — but it must not report success.
    { status: result.ok ? 200 : 502 }
  );
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
