import Link from 'next/link';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Mailing list' };
export const dynamic = 'force-dynamic';

function when(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The marketing list, and the evidence behind it.
 *
 * Shows the consent date next to every address deliberately: the privacy policy
 * says marketing is sent "with your consent", so if anyone ever asks why they
 * were emailed, the answer has to be visible here rather than reconstructed.
 */
/** Rows per page. A mailing list is the fastest-growing table a shop has. */
const PAGE_SIZE = 500;

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams).q ?? '').trim();

  /*
   * Searched in the database, and the counts come from count() rather than
   * from the fetched rows. The list is capped, and a mailing list is the one
   * table that grows without anyone doing anything — so counting what happened
   * to be fetched would understate the list precisely as it got valuable, and
   * "Subscribed: 500" would sit there looking plausible for ever.
   */
  const where = query ? { email: { contains: query } } : {};

  const [subscribers, matching, activeCount, goneCount] = await Promise.all([
    prisma.subscriber
      .findMany({ where, orderBy: { createdAt: 'desc' }, take: PAGE_SIZE })
      .catch(() => []),
    prisma.subscriber.count({ where }).catch(() => 0),
    prisma.subscriber.count({ where: { unsubscribedAt: null } }).catch(() => 0),
    prisma.subscriber.count({ where: { NOT: { unsubscribedAt: null } } }).catch(() => 0),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Mailing list</h2>
        <p className="max-w-2xl text-sm text-greige">
          Addresses captured by the footer form. Export before sending a campaign — every marketing
          email must carry that subscriber&rsquo;s own unsubscribe link.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-greige">Subscribed</p>
          <p className="mt-1.5 text-2xl font-extrabold">{activeCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-greige">Unsubscribed</p>
          <p className="mt-1.5 text-2xl font-extrabold">{goneCount}</p>
        </div>
        <div className="card flex items-center p-5">
          <a href="/api/admin/subscribers/export" className="btn btn-primary !rounded-full px-6">
            Export CSV
          </a>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by email address…"
          aria-label="Search subscribers"
          className="field min-w-[16rem] flex-1"
        />
        <button type="submit" className="btn btn-secondary shrink-0">
          Search
        </button>
        {query && (
          <Link href="/admin/subscribers" className="text-micro text-greige underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>

      {query && (
        <p className="text-sm text-greige">
          {matching} matching &ldquo;{query}&rdquo;
          {subscribers.length < matching ? ` · showing first ${subscribers.length}` : ''}
        </p>
      )}

      {subscribers.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">
          {query ? `No address matches "${query}".` : 'Nobody has signed up yet.'}
        </div>
      ) : (
        /* Scrolls in place — this is the list that grows fastest of all. */
        <div className="card max-h-[calc(100vh-26rem)] min-h-[18rem] overflow-hidden">
          <div className="scroll-x h-full overflow-y-auto overscroll-contain">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-greige">
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Consent given</th>
                  <th className="p-4 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b border-rule/60 last:border-0">
                    <td className="p-4">{s.email}</td>
                    <td className="p-4">
                      {s.unsubscribedAt ? (
                        <span className="text-greige">
                          Left {when(s.unsubscribedAt)}
                        </span>
                      ) : (
                        <span className="text-verdigris">Subscribed</span>
                      )}
                    </td>
                    <td className="p-4 text-greige">{when(s.consentAt)}</td>
                    <td className="p-4 text-greige">{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
