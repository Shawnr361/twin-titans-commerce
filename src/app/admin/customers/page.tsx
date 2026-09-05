import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Everyone who has actually bought something, and how to reach them.
 *
 * NOT the subscriber list. A subscriber gave an address for marketing and can
 * withdraw it; a customer gave one so we could fulfil an order they paid for,
 * and we need it to answer "where is my parcel". Mixing the two would either
 * lose a buyer when they unsubscribe, or mail marketing to someone who never
 * asked for it. Different consent, different list.
 *
 * Built from orders rather than from a stored profile, so it cannot drift out
 * of step with what was really bought — and it shows the phone number, which is
 * how a Nigerian customer is actually reached when email goes unread.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams).q ?? '').trim().toLowerCase();

  const [orders, settings] = await Promise.all([
    prisma.order
      .findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          email: true,
          phone: true,
          totalMinor: true,
          currency: true,
          paymentStatus: true,
          createdAt: true,
          shippingAddress: true,
        },
      })
      .catch(() => []),
    getStoreSettings(),
  ]);

  interface Row {
    email: string;
    name: string;
    phone: string;
    place: string;
    orders: number;
    paidOrders: number;
    spentMinor: number;
    currency: string;
    last: Date;
    lastNumber: number;
  }

  const byEmail = new Map<string, Row>();

  for (const order of orders) {
    const key = (order.email || '').toLowerCase().trim();
    if (!key) continue;

    const address = order.shippingAddress as Record<string, string> | null;
    const existing = byEmail.get(key);
    const paid = order.paymentStatus === 'PAID';

    if (!existing) {
      byEmail.set(key, {
        email: order.email,
        name: address?.name ?? '',
        // Orders carry a phone; the address usually repeats it. Either will do.
        phone: order.phone || address?.phone || '',
        place: [address?.city, address?.country].filter(Boolean).join(', '),
        orders: 1,
        paidOrders: paid ? 1 : 0,
        spentMinor: paid ? order.totalMinor : 0,
        currency: order.currency,
        last: order.createdAt,
        lastNumber: order.number,
      });
      continue;
    }

    existing.orders += 1;
    if (paid) {
      existing.paidOrders += 1;
      existing.spentMinor += order.totalMinor;
    }
    // Fill anything the newest order happened not to carry.
    existing.name ||= address?.name ?? '';
    existing.phone ||= order.phone || address?.phone || '';
    existing.place ||= [address?.city, address?.country].filter(Boolean).join(', ');
  }

  const all = [...byEmail.values()].sort((a, b) => b.last.getTime() - a.last.getTime());

  /*
   * Filtered in memory, and here that is the correct choice rather than a
   * shortcut — unlike the product list, this page reads EVERY order to build
   * its rows, so there is no truncation for a filter to hide behind. Matching
   * on name, email, phone and place, because "the customer in Sheffield" and
   * "the one whose number ends 1278" are both real ways of looking someone up.
   */
  const rows = query
    ? all.filter((r) =>
        [r.name, r.email, r.phone, r.place]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query))
      )
    : all;

  const repeat = rows.filter((r) => r.paidOrders > 1).length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Customers</h2>
        <p className="max-w-2xl text-sm text-greige">
          Everyone who has placed an order, with the address and phone number they gave. This is
          separate from your <Link href="/admin/subscribers" className="underline">subscribers</Link>{' '}
          — those signed up for marketing, these bought something.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, email, phone or city…"
          aria-label="Search customers"
          className="field min-w-[16rem] flex-1"
        />
        <button type="submit" className="btn btn-secondary shrink-0">
          Search
        </button>
        {query && (
          <Link href="/admin/customers" className="text-micro text-greige underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-6 text-sm">
        <span className="text-greige">
          <strong className="text-onyx">{rows.length}</strong>
          {query ? <> matching, of {all.length} customers</> : <> customers</>}
        </span>
        <span className="text-greige">
          <strong className="text-onyx">{repeat}</strong> have ordered more than once
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">
          {query ? `Nobody matches "${query}" among your ${all.length} customers.` : 'No orders yet.'}
        </div>
      ) : (
        /* Scrolls in place: the customer list only grows. */
        <div className="card max-h-[calc(100vh-24rem)] min-h-[18rem] overflow-x-auto overflow-y-auto overscroll-contain">
          <table className="w-full text-left text-sm">
            <thead className="text-micro uppercase tracking-wide text-greige">
              <tr className="border-b border-rule">
                <th className="p-3">Customer</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Where</th>
                <th className="p-3 text-right">Orders</th>
                <th className="p-3 text-right">Spent</th>
                <th className="p-3">Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email} className="border-b border-rule/60 align-top">
                  <td className="p-3">
                    <div className="font-medium text-onyx">{row.name || '—'}</div>
                    {row.paidOrders > 1 && (
                      <span className="text-micro text-verdigris">repeat customer</span>
                    )}
                  </td>
                  <td className="p-3">
                    {/* Both clickable: on a phone these are one tap to contact. */}
                    <a href={`mailto:${row.email}`} className="block break-all underline">
                      {row.email}
                    </a>
                    {row.phone && (
                      <a href={`tel:${row.phone}`} className="block text-greige underline">
                        {row.phone}
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-greige">{row.place || '—'}</td>
                  <td className="p-3 text-right">
                    {row.paidOrders}
                    {row.orders > row.paidOrders && (
                      <span className="text-greige"> / {row.orders}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {formatMoney(row.spentMinor, row.currency || settings.baseCurrency)}
                  </td>
                  <td className="p-3 text-greige">
                    #{row.lastNumber}
                    <div className="text-micro">{row.last.toLocaleDateString()}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
