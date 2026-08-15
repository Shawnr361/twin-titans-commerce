import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const settings = await getStoreSettings();

  const [
    productCount,
    draftCount,
    orderCount,
    pendingSupplierOrders,
    paidOrders,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.product.count({ where: { status: 'DRAFT' } }).catch(() => 0),
    prisma.order.count().catch(() => 0),
    prisma.supplierOrder.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.order
      .aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { totalMinor: true, costMinor: true, shippingMinor: true },
      })
      .catch(() => null),
    prisma.order
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          number: true,
          email: true,
          status: true,
          paymentStatus: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
        },
      })
      .catch(() => []),
  ]);

  const revenue = paidOrders?._sum.totalMinor ?? 0;
  const cost = paidOrders?._sum.costMinor ?? 0;
  const shipping = paidOrders?._sum.shippingMinor ?? 0;
  const profit = revenue - cost - shipping;

  const stats = [
    { label: 'Revenue (paid)', value: formatMoney(revenue, settings.baseCurrency) },
    { label: 'Gross profit', value: formatMoney(profit, settings.baseCurrency) },
    { label: 'Orders', value: String(orderCount) },
    { label: 'Live products', value: `${productCount}${draftCount ? ` (+${draftCount} draft)` : ''}` },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-5">
            <p className="text-xs uppercase tracking-wide text-mut">{s.label}</p>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {pendingSupplierOrders > 0 && (
        <Link
          href="/admin/fulfilment"
          className="panel flex items-center justify-between border-amber-500/40 bg-amber-500/10 p-5 transition hover:border-amber-400"
        >
          <div>
            <p className="text-sm font-bold text-amber-200">
              {pendingSupplierOrders} order{pendingSupplierOrders === 1 ? '' : 's'} waiting to be
              placed with a supplier
            </p>
            <p className="text-xs text-amber-200/80">
              Customers have paid. Nothing ships until these are placed.
            </p>
          </div>
          <span className="text-sm text-amber-200">Open queue →</span>
        </Link>
      )}

      <section className="panel overflow-hidden">
        <h2 className="border-b border-line p-5 text-sm font-bold">Recent orders</h2>

        {recentOrders.length === 0 ? (
          <p className="p-8 text-center text-sm text-mut">No orders yet.</p>
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mut">
                  <th className="p-4 font-medium">Order</th>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Payment</th>
                  <th className="p-4 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 last:border-0">
                    <td className="p-4">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-accent2">
                        #{o.number}
                      </Link>
                    </td>
                    <td className="p-4 text-mut">{o.email}</td>
                    <td className="p-4">
                      <span className="chip">{o.status}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`chip ${
                          o.paymentStatus === 'PAID' ? 'border-accent/50 text-accent2' : ''
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold">
                      {formatMoney(o.totalMinor, o.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
