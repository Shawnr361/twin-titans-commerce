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
export default async function SubscribersPage() {
  const subscribers = await prisma.subscriber
    .findMany({ orderBy: { createdAt: 'desc' }, take: 1000 })
    .catch(() => []);

  const active = subscribers.filter((s) => !s.unsubscribedAt);
  const gone = subscribers.filter((s) => s.unsubscribedAt);

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
          <p className="mt-1.5 text-2xl font-extrabold">{active.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-greige">Unsubscribed</p>
          <p className="mt-1.5 text-2xl font-extrabold">{gone.length}</p>
        </div>
        <div className="card flex items-center p-5">
          <a href="/api/admin/subscribers/export" className="btn btn-primary !rounded-full px-6">
            Export CSV
          </a>
        </div>
      </div>

      {subscribers.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">
          Nobody has signed up yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-x">
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
