import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unsubscribeUrl } from '@/lib/newsletter';
import { siteOrigin } from '@/lib/seo';

/**
 * CSV of the active mailing list.
 *
 * The unsubscribe URL is a column, not an afterthought. Whatever tool sends the
 * campaign has to merge a per-subscriber link into every message — a single
 * shared "unsubscribe" address would remove the wrong person, and the privacy
 * policy commits to a working link in each email.
 *
 * Unsubscribed rows are excluded outright: exporting them invites someone to
 * paste the whole file into a sending tool and mail people who have left.
 */
function cell(value: string): string {
  /*
   * A leading =, +, - or @ makes Excel treat the cell as a formula. An address
   * is never a formula, so the value is prefixed to keep it inert.
   */
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { unsubscribedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const base = siteOrigin();
  const rows = [
    ['email', 'consent_given', 'source', 'unsubscribe_url'].join(','),
    ...subscribers.map((s) =>
      [
        cell(s.email),
        cell(s.consentAt.toISOString()),
        cell(s.source),
        cell(unsubscribeUrl(s.token, base)),
      ].join(',')
    ),
  ].join('\r\n');

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(rows, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mailing-list-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
