import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Track your order' };
export const dynamic = 'force-dynamic';

/**
 * Customer order tracking.
 *
 * Requires BOTH the order number and the email it was placed with. An order
 * number alone is guessable (they are sequential), and order records contain a
 * full home address — so the email acts as the shared secret.
 */
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string; email?: string }>;
}) {
  const params = await searchParams;
  const number = parseInt(params.number ?? '', 10);
  const email = (params.email ?? '').trim().toLowerCase();

  const order =
    Number.isFinite(number) && email
      ? await prisma.order
          .findFirst({
            where: { number, email },
            include: {
              lineItems: true,
              supplierOrders: {
                select: { status: true, trackingNumber: true, trackingUrl: true, trackingCarrier: true },
              },
            },
          })
          .catch(() => null)
      : null;

  const searched = Number.isFinite(number) && Boolean(email);

  return (
    <div className="container-x py-14">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Track your order</h1>
          <p className="text-sm text-mut">
            Enter your order number and the email you ordered with.
          </p>
        </header>

        <form method="get" className="panel flex flex-col gap-3 p-6 sm:flex-row">
          <input
            name="number"
            className="input"
            placeholder="Order number"
            defaultValue={params.number ?? ''}
            aria-label="Order number"
            required
          />
          <input
            name="email"
            type="email"
            className="input"
            placeholder="Email address"
            defaultValue={params.email ?? ''}
            aria-label="Email address"
            required
          />
          <button type="submit" className="btn-primary shrink-0">
            Track
          </button>
        </form>

        {searched && !order && (
          <div className="panel p-8 text-center text-sm text-mut">
            We could not find an order with those details. Check the number and email and try again.
          </div>
        )}

        {order && (
          <div className="panel space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Order #{order.number}</p>
                <p className="text-xs text-mut">
                  Placed {order.createdAt.toISOString().slice(0, 10)}
                </p>
              </div>
              <span className="chip border-accent/50 text-accent2">{order.status}</span>
            </div>

            <ul className="space-y-3 border-y border-line py-4">
              {order.lineItems.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">{item.productTitle}</p>
                    <p className="text-xs text-mut">× {item.quantity}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatMoney(order.totalMinor, order.currency)}</span>
            </div>

            {order.supplierOrders.some((s) => s.trackingNumber) ? (
              <div className="space-y-2">
                <p className="label mb-0">Tracking</p>
                {order.supplierOrders
                  .filter((s) => s.trackingNumber)
                  .map((s, i) => (
                    <a
                      key={i}
                      href={s.trackingUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-line bg-black/20 p-4 text-sm text-accent2 hover:border-accent/50"
                    >
                      {s.trackingNumber}
                      {s.trackingCarrier ? ` · ${s.trackingCarrier}` : ''} ↗
                    </a>
                  ))}
              </div>
            ) : (
              <p className="rounded-xl bg-white/5 p-4 text-sm text-mut">
                Your parcel has not shipped yet. Tracking appears here — and lands in your inbox —
                as soon as it does.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
