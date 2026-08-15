import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const orders = await prisma.order
    .findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { lineItems: true } },
        supplierOrders: { select: { status: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold tracking-tight">Orders</h2>
        <p className="text-sm text-mut">{orders.length} order(s)</p>
      </header>

      {orders.length === 0 ? (
        <div className="panel p-12 text-center text-sm text-mut">No orders yet.</div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="scroll-x">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mut">
                  <th className="p-4 font-medium">Order</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Items</th>
                  <th className="p-4 font-medium">Payment</th>
                  <th className="p-4 font-medium">Supplier</th>
                  <th className="p-4 text-right font-medium">Total</th>
                  <th className="p-4 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const profit = order.totalMinor - order.shippingMinor - order.costMinor;
                  const unplaced = order.supplierOrders.filter((s) => s.status === 'PENDING').length;

                  return (
                    <tr key={order.id} className="border-b border-line/60 last:border-0">
                      <td className="p-4">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium hover:text-accent2"
                        >
                          #{order.number}
                        </Link>
                      </td>
                      <td className="p-4 text-mut">
                        {order.createdAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="p-4 text-mut">{order.email}</td>
                      <td className="p-4 text-mut">{order._count.lineItems}</td>
                      <td className="p-4">
                        <span
                          className={`chip ${
                            order.paymentStatus === 'PAID' ? 'border-accent/50 text-accent2' : ''
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        {order.supplierOrders.length === 0 ? (
                          <span className="text-xs text-mut">—</span>
                        ) : unplaced > 0 ? (
                          <span className="chip border-amber-500/50 text-amber-300">
                            {unplaced} to place
                          </span>
                        ) : (
                          <span className="chip border-accent/50 text-accent2">placed</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold">
                        {formatMoney(order.totalMinor, order.currency)}
                      </td>
                      <td
                        className={`p-4 text-right font-semibold ${profit <= 0 ? 'text-red-400' : 'text-accent2'}`}
                      >
                        {formatMoney(profit, order.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
