import Link from 'next/link';
import { clearCart } from '@/lib/cart';
import { prisma } from '@/lib/db';
import { markOrderPaid } from '@/lib/orders';
import { verifyTransaction } from '@/lib/payments/paystack';
import { Price } from '@/components/commerce/Price';

export const metadata = { title: 'Order confirmed', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Post-payment landing page.
 *
 * Verifies the transaction server-side rather than trusting the redirect. The
 * webhook may already have processed the same payment, so `markOrderPaid` is
 * idempotent by reference — whichever arrives first wins and the second is a
 * no-op.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; order?: string; paypal?: string }>;
}) {
  const params = await searchParams;
  let orderId = params.order ?? null;
  let failure: string | null = null;

  if (params.ref) {
    try {
      const verification = await verifyTransaction(params.ref);
      const metaOrderId = (verification.metadata as { orderId?: string } | null)?.orderId;

      if (verification.status === 'success' && metaOrderId) {
        orderId = metaOrderId;
        await markOrderPaid({
          orderId: metaOrderId,
          provider: 'PAYSTACK',
          reference: verification.reference,
          amountMinor: verification.amount,
          currency: verification.currency,
          feeMinor: verification.fees ?? 0,
          raw: verification,
        });
      } else {
        failure = 'That payment was not completed.';
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : 'Could not verify the payment.';
    }
  }

  const order = orderId
    ? await prisma.order
        .findUnique({ where: { id: orderId }, include: { lineItems: true } })
        .catch(() => null)
    : null;

  if (order?.paymentStatus === 'PAID') {
    await clearCart();
  }

  if (failure || !order) {
    return (
      <div className="shell py-24">
        <div className="max-w-text">
          <hr className="rule-gold" />
          <h1 className="display-m mt-5">Payment not confirmed</h1>
          <p className="mt-5 text-body text-greige">
            {failure ?? 'We could not find that order.'} If money has left your account, contact us
            with your payment reference and we will resolve it immediately.
          </p>
          <Link href="/cart" className="btn btn-secondary mt-8">
            Back to your bag
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <hr className="rule-gold" />
        <p className="label mt-5">Order {order.number}</p>
        <h1 className="display-l mt-3">Thank you.</h1>
        <p className="mt-5 text-body text-greige">
          Your order is confirmed and a receipt is on its way to {order.email}.
        </p>

        <ul className="mt-12 divide-y divide-rule border-y border-rule">
          {order.lineItems.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-5">
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
              <Price
                minor={item.unitPriceMinor * item.quantity}
                currency={order.currency}
                className="text-body text-onyx"
              />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-between gap-4">
          <span className="font-display text-d2 text-onyx">Total paid</span>
          <Price
            minor={order.totalMinor}
            currency={order.currency}
            className="font-display text-d2 text-onyx"
          />
        </div>

        <p className="mt-12 border-t border-rule pt-8 text-body text-greige">
          We are placing your order with our supplier now. A tracking number follows by email as
          soon as it ships — usually within one to three business days.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link href={`/orders/track?number=${order.number}`} className="btn btn-primary">
            Track this order
          </Link>
          <Link href="/collections/all" className="link text-label">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
