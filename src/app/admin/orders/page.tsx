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
        /*
         * The titles are snapshotted onto the line item at sale, so listing
         * them costs no extra joins and stays correct even if the product is
         * later edited or deleted.
         */
        lineItems: {
          select: { id: true, productTitle: true, variantTitle: true, quantity: true },
        },
        supplierOrders: { select: { status: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold tracking-tight">Orders</h2>
        <p className="text-sm text-greige">{orders.length} order(s)</p>
      </header>

      {orders.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">No orders yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-x">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-greige">
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
                    <tr key={order.id} className="border-b border-rule/60 last:border-0">
                      <td className="p-4">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium hover:text-verdigris"
                        >
                          #{order.number}
                        </Link>
                      </td>
                      <td className="p-4 text-greige">
                        {order.createdAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="p-4 text-greige">{order.email}</td>
                      <td className="p-4 text-greige">
                        {/*
                          A bare count ("1") says nothing about what was sold.
                          The first two items are named in full; anything beyond
                          that is summarised rather than allowed to grow the row
                          without limit.
                        */}
                        <ul className="space-y-1">
                          {order.lineItems.slice(0, 2).map((item) => (
                            <li key={item.id} className="leading-tight">
                              <span className="line-clamp-1 text-bone/90">{item.productTitle}</span>
                              <span className="text-xs text-greige">
                                {item.variantTitle && item.variantTitle !== 'Default'
                                  ? `${item.variantTitle} × ${item.quantity}`
                                  : `× ${item.quantity}`}
                              </span>
                            </li>
                          ))}
                          {order._count.lineItems > 2 && (
                            <li className="text-xs text-greige">
                              +{order._count.lineItems - 2} more
                            </li>
                          )}
                        </ul>
                      </td>
                      <td className="p-4">
                        <span
                          className={`tag ${
                            order.paymentStatus === 'PAID' ? 'border-verdigris/50 text-verdigris' : ''
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        {order.supplierOrders.length === 0 ? (
                          <span className="text-xs text-greige">—</span>
                        ) : unplaced > 0 ? (
                          <span className="tag border-warn/50 text-warn">
                            {unplaced} to place
                          </span>
                        ) : (
                          <span className="tag border-verdigris/50 text-verdigris">placed</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold">
                        {formatMoney(order.totalMinor, order.currency)}
                      </td>
                      <td
                        className={`p-4 text-right font-semibold ${profit <= 0 ? 'text-danger' : 'text-verdigris'}`}
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
