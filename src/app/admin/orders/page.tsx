import Link from 'next/link';
import { prisma } from '@/lib/db';
import { DeleteOrderButton } from '@/components/admin/DeleteOrderButton';
import { CancelOrderButton } from '@/components/admin/CancelOrderButton';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

/** Rows per page. Orders accumulate for ever; the list must not try to hold them all. */
const PAGE_SIZE = 100;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams).q ?? '').trim();

  /*
   * Searched in the database, for the same reason the product list is: the
   * page holds 100 rows and orders only accumulate, so filtering what happens
   * to be on screen would quietly stop finding older ones exactly when the
   * shop is busy enough to need looking them up.
   *
   * An all-digit query is treated as an order NUMBER as well as text, because
   * that is what a customer quotes in an email.
   */
  const asNumber = /^[0-9]+$/.test(query) ? Number(query) : null;
  const where = query
    ? {
        OR: [
          { email: { contains: query } },
          ...(asNumber !== null ? [{ number: asNumber }] : []),
        ],
      }
    : {};

  const [orders, matching, total] = await Promise.all([
    prisma.order
    .findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      include: {
        _count: { select: { lineItems: true } },
        /*
         * The titles are snapshotted onto the line item at sale, so listing
         * them costs no extra joins and stays correct even if the product is
         * later edited or deleted.
         */
        lineItems: {
          select: {
            id: true,
            productTitle: true,
            variantTitle: true,
            quantity: true,
            imageUrl: true,
          },
        },
        supplierOrders: { select: { status: true } },
      },
    })
      .catch(() => []),
    prisma.order.count({ where }).catch(() => 0),
    prisma.order.count().catch(() => 0),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold tracking-tight">Orders</h2>
        {/* The real total, not the number that happened to be fetched. */}
        <p className="text-sm text-greige">
          {query ? `${matching} matching "${query}" · ${total} order(s)` : `${total} order(s)`}
          {orders.length < matching ? ` · showing first ${orders.length}` : ''}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by order number or email…"
          aria-label="Search orders"
          className="field min-w-[16rem] flex-1"
        />
        <button type="submit" className="btn btn-secondary shrink-0">
          Search
        </button>
        {query && (
          <Link href="/admin/orders" className="text-micro text-greige underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">
          {query ? `Nothing matches "${query}" among your ${total} order(s).` : 'No orders yet.'}
        </div>
      ) : (
        /*
          Bounded height so the table scrolls in place. Orders only ever grow,
          and a list that runs the length of the page pushes everything else
          out of reach a little further every week.
        */
        <div className="card max-h-[calc(100vh-20rem)] min-h-[20rem] overflow-hidden">
          <div className="scroll-x h-full overflow-y-auto overscroll-contain">
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
                  <th className="p-4 text-right font-medium"><span className="sr-only">Actions</span></th>
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
                            <li key={item.id} className="flex items-start gap-2.5 leading-tight">
                              {/*
                                Snapshotted at sale, like the titles beside it —
                                so the thumbnail keeps showing what was actually
                                bought even if the product is later re-imaged or
                                deleted. Plain <img>: these are supplier CDN URLs
                                and next/image would need every host whitelisted.
                              */}
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  loading="lazy"
                                  className="mt-0.5 h-10 w-10 flex-none rounded border border-rule object-cover"
                                />
                              ) : (
                                <span className="mt-0.5 h-10 w-10 flex-none rounded border border-rule" />
                              )}
                              <span className="min-w-0">
                                <span className="line-clamp-1 text-onyx">{item.productTitle}</span>
                                <span className="block text-xs text-greige">
                                  {item.variantTitle && item.variantTitle !== 'Default'
                                    ? `${item.variantTitle} × ${item.quantity}`
                                    : `× ${item.quantity}`}
                                </span>
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
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <CancelOrderButton
                            orderId={order.id}
                            number={order.number}
                            status={order.status}
                          />
                          <DeleteOrderButton orderId={order.id} number={order.number} />
                        </div>
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
