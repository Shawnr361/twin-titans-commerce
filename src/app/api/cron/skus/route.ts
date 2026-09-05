import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runSkuAuditBatch } from '@/lib/dropship/sku-audit';

export const dynamic = 'force-dynamic';

/**
 * Run one batch of the standing SKU check, on demand.
 *
 * The work itself lives in lib/dropship/sku-audit so the tracking cron can run
 * it too — see the note there on why it rides along rather than taking a cron
 * entry of its own. This route stays for running a batch by hand and for
 * watching what a single pass does.
 */
async function authorise(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization') ?? '';
    const url = new URL(request.url);
    if (header === `Bearer ${secret}` || url.searchParams.get('key') === secret) return true;
  }
  /* An admin can always run it by hand from the browser. */
  return Boolean(await getSession().catch(() => null));
}

export async function GET(request: Request) {
  if (!(await authorise(request))) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const r = await runSkuAuditBatch();

  return NextResponse.json({
    checkedProducts: r.checkedProducts,
    wrappedToStart: r.wrappedToStart,
    rematched: r.rematched.length,
    blocked: r.blocked.length,
    restored: r.restored.length,
    stillBlockedTotal: r.stillBlockedTotal,
    nextCursor: r.nextCursor,
    samples: {
      rematched: r.rematched.slice(0, 5),
      blocked: r.blocked.slice(0, 5),
      restored: r.restored.slice(0, 5),
    },
    problems: r.problems.slice(0, 5),
  });
}
