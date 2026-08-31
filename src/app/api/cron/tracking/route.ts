import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncTracking } from '@/lib/dropship/aliexpress-place';

export const dynamic = 'force-dynamic';

/**
 * Pull tracking numbers for placed supplier orders and email the customer.
 *
 * Safe to run on a schedule and safe to run twice: nothing is written unless
 * the tracking number actually changed, and the shipping email refuses to
 * send twice for the same number.
 *
 * READ-ONLY against AliExpress. Unlike placing an order, this spends nothing,
 * which is why it may run unattended on a cron where placing may not.
 */
async function authorise(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization') ?? '';
    const url = new URL(request.url);
    if (header === `Bearer ${secret}` || url.searchParams.get('key') === secret) return true;
  }
  return Boolean(await getSession().catch(() => null));
}

async function run(request: Request) {
  if (!(await authorise(request))) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  try {
    const result = await syncTracking();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Tracking sync failed.' },
      { status: 500 }
    );
  }
}

export const GET = run;
export const POST = run;
