import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncTracking } from '@/lib/dropship/aliexpress-place';
import { runSkuAuditBatch } from '@/lib/dropship/sku-audit';

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

    /*
     * One batch of the standing SKU check rides along here.
     *
     * It needs to run for ever on a schedule, and the alternative was a fourth
     * cron on the host — which on this account means a shell script in $HOME
     * holding the cron secret, because that is how keepalive, fx-refresh and
     * tracking-sync are all wired. This job already runs every thirty minutes
     * and already authenticates, so the work rides along instead: same
     * schedule, no new credential written anywhere.
     *
     * Deliberately AFTER tracking and deliberately non-fatal. Tracking is what
     * emails a customer that their parcel has shipped, and a supplier lookup
     * failing must never cost anyone that. A batch is three products, so it
     * adds seconds, not minutes.
     */
    let skuAudit: unknown = null;
    try {
      const audit = await runSkuAuditBatch();
      skuAudit = {
        checked: audit.checkedProducts,
        rematched: audit.rematched.length,
        blocked: audit.blocked.length,
        restored: audit.restored.length,
        stillBlockedTotal: audit.stillBlockedTotal,
      };
    } catch (err) {
      skuAudit = { error: err instanceof Error ? err.message : 'SKU audit batch failed.' };
    }

    return NextResponse.json({ ok: true, ...result, skuAudit });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Tracking sync failed.' },
      { status: 500 }
    );
  }
}

export const GET = run;
export const POST = run;
