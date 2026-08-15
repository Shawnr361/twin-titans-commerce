import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { ShippingAddress } from '@/lib/dropship/fulfilment';

export const dynamic = 'force-dynamic';

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order
    .findUnique({
      where: { id },
      include: {
        lineItems: true,
        payments: true,
        events: { orderBy: { createdAt: 'desc' } },
        supplierOrders: { include: { supplier: true, items: true } },
      },
    })
    .catch(() => null);

  if (!order) notFound();

  const address = order.shippingAddress as unknown as ShippingAddress;
  const profit = order.totalMinor - order.shippingMinor - order.costMinor;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Order #{order.number}</h2>
          <p className="text-sm text-mut">
            {order.createdAt.toISOString().slice(0, 16).replace('T', ' ')} · {order.email}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="chip">{order.status}</span>
          <span
            className={`chip ${order.paymentStatus === 'PAID' ? 'border-accent/50 text-accent2' : ''}`}
          >
            {order.paymentStatus}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <h3 className="border-b border-line p-5 text-sm font-bold">Items</h3>
            <ul className="divide-y divide-line/60">
              {order.lineItems.map((item) => (
                <li key={item.id} className="flex items-center gap-4 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/40">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{item.productTitle}</p>
                    <p className="text-xs text-mut">
                      {item.variantTitle} × {item.quantity}
                      {item.sku ? ` · ${item.sku}` : ''}
                    </p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-accent2 hover:underline"
                      >
                        Supplier listing ↗
                      </a>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">
                      {formatMoney(item.unitPriceMinor * item.quantity, order.currency)}
                    </p>
                    <p className="text-xs text-mut">
                      cost {formatMoney(item.unitCostMinor * item.quantity, order.currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel overflow-hidden">
            <h3 className="border-b border-line p-5 text-sm font-bold">Supplier orders</h3>
            {order.supplierOrders.length === 0 ? (
              <p className="p-5 text-sm text-mut">
                Not routed to a supplier yet. This happens automatically once payment is confirmed.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {order.supplierOrders.map((so) => (
                  <li key={so.id} className="space-y-2 p-5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{so.supplier.name}</span>
                      <span className="chip">{so.platform}</span>
                      <span
                        className={`chip ${so.status === 'PENDING' ? 'border-amber-500/50 text-amber-300' : 'border-accent/50 text-accent2'}`}
                      >
                        {so.status}
                      </span>
                    </div>
                    {so.externalOrderNo && (
                      <p className="text-xs text-mut">Supplier ref: {so.externalOrderNo}</p>
                    )}
                    {so.trackingNumber && (
                      <a
                        href={so.trackingUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent2 hover:underline"
                      >
                        Tracking: {so.trackingNumber} ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line p-4">
              <Link href="/admin/fulfilment" className="btn-ghost text-xs">
                Open supplier queue
              </Link>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel space-y-3 p-5 text-sm">
            <h3 className="text-sm font-bold">Totals</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-mut">Subtotal</dt>
                <dd>{formatMoney(order.subtotalMinor, order.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mut">Shipping</dt>
                <dd>{formatMoney(order.shippingMinor, order.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-bold">
                <dt>Total</dt>
                <dd>{formatMoney(order.totalMinor, order.currency)}</dd>
              </div>
              <div className="flex justify-between text-mut">
                <dt>Goods cost</dt>
                <dd>−{formatMoney(order.costMinor, order.currency)}</dd>
              </div>
              <div
                className={`flex justify-between font-bold ${profit <= 0 ? 'text-red-400' : 'text-accent2'}`}
              >
                <dt>Profit</dt>
                <dd>{formatMoney(profit, order.currency)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel space-y-2 p-5 text-sm">
            <h3 className="text-sm font-bold">Ship to</h3>
            <address className="not-italic leading-relaxed text-mut">
              {address?.name}
              <br />
              {address?.line1}
              <br />
              {address?.line2 && (
                <>
                  {address.line2}
                  <br />
                </>
              )}
              {[address?.city, address?.state].filter(Boolean).join(', ')}
              <br />
              {[address?.postcode, address?.country].filter(Boolean).join(' ')}
              {address?.phone && (
                <>
                  <br />
                  {address.phone}
                </>
              )}
            </address>
          </section>

          <section className="panel overflow-hidden">
            <h3 className="border-b border-line p-5 text-sm font-bold">Timeline</h3>
            <ul className="divide-y divide-line/60">
              {order.events.map((event) => (
                <li key={event.id} className="p-4 text-xs">
                  <p className="text-ink">{event.message}</p>
                  <p className="text-mut">
                    {event.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
