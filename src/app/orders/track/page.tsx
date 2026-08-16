import { prisma } from '@/lib/db';
import { Price } from '@/components/commerce/Price';

export const metadata = { title: 'Track your order' };
export const dynamic = 'force-dynamic';

/**
 * Customer order tracking.
 *
 * Requires BOTH the order number and the email it was placed with. Order
 * numbers are sequential and therefore guessable, and an order record holds a
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
  const searched = Number.isFinite(number) && Boolean(email);

  const order = searched
    ? await prisma.order
        .findFirst({
          where: { number, email },
          include: {
            lineItems: true,
            supplierOrders: {
              select: {
                status: true,
                trackingNumber: true,
                trackingUrl: true,
                trackingCarrier: true,
              },
            },
          },
        })
        .catch(() => null)
    : null;

  return (
    <div className="shell py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <header>
          <hr className="rule-gold" />
          <h1 className="display-l mt-5">Track your order</h1>
          <p className="mt-4 text-body text-greige">
            Enter your order number and the email address you ordered with.
          </p>
        </header>

        <form method="get" className="mt-10 grid gap-4 sm:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <label className="field-label" htmlFor="number">
              Order number
            </label>
            <input
              id="number"
              name="number"
              inputMode="numeric"
              required
              defaultValue={params.number ?? ''}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={params.email ?? ''}
              className="field"
            />
          </div>
          <button type="submit" className="btn btn-primary self-end">
            Track
          </button>
        </form>

        {searched && !order && (
          <p className="mt-10 border-t border-rule pt-8 text-body text-greige">
            We could not find an order with those details. Check the number and email, and note that
            the email must be the one used at checkout.
          </p>
        )}

        {order && (
          <section className="mt-12 border-t border-rule pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="font-display text-d2 text-onyx">Order {order.number}</p>
                <p className="mt-1 text-label text-quiet">
                  Placed {order.createdAt.toISOString().slice(0, 10)}
                </p>
              </div>
              <span className="tag">{order.status.replace(/_/g, ' ')}</span>
            </div>

            <ul className="mt-8 divide-y divide-rule border-y border-rule">
              {order.lineItems.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-4">
                  <div className="media aspect-product w-16 shrink-0">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-onyx">{item.productTitle}</p>
                    <p className="text-label text-quiet">
                      {item.variantTitle} · {item.quantity}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-between gap-4">
              <span className="label">Total</span>
              <Price
                minor={order.totalMinor}
                currency={order.currency}
                className="text-body font-medium text-onyx"
              />
            </div>

            <div className="mt-10">
              <p className="label">Tracking</p>
              <hr className="rule mt-4" />

              {order.supplierOrders.some((s) => s.trackingNumber) ? (
                <ul className="mt-4 space-y-3">
                  {order.supplierOrders
                    .filter((s) => s.trackingNumber)
                    .map((s, i) => (
                      <li key={i}>
                        <a
                          href={s.trackingUrl ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link text-body"
                        >
                          {s.trackingNumber}
                          {s.trackingCarrier ? ` · ${s.trackingCarrier}` : ''} ↗
                        </a>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-4 text-body text-greige">
                  Your parcel has not shipped yet. Tracking appears here — and arrives by email — as
                  soon as it does.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
