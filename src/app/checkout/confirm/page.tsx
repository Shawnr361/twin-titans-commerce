import Link from 'next/link';
import { clearCart } from '@/lib/cart';
import { prisma } from '@/lib/db';
import { markOrderPaid } from '@/lib/orders';
import { verifyTransaction } from '@/lib/payments/paystack';
import { Price } from '@/components/commerce/Price';

export const metadata = { title: 'Order confirmed' };
export const dynamic = 'force-dynamic';

/**
 * Post-payment landing page.
 *
 * It verifies the transaction server-side rather than trusting the redirect —
 * and because the webhook may have already processed the same payment,
 * `markOrderPaid` is idempotent by reference. Whichever arrives first wins and
 * the second is a no-op.
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
        .findUnique({
          where: { id: orderId },
          include: { lineItems: true, supplierOrders: { select: { id: true } } },
        })
        .catch(() => null)
    : null;

  if (order?.paymentStatus === 'PAID') {
    await clearCart();
  }

  if (failure || !order) {
    return (
      <div className="container-x py-20">
        <div className="panel mx-auto max-w-md space-y-4 p-10 text-center">
          <h1 className="text-xl font-bold">Payment not confirmed</h1>
          <p className="text-sm text-mut">
            {failure ?? 'We could not find that order.'} If money left your account, contact us with
            your payment reference and we will sort it out immediately.
          </p>
          <Link href="/cart" className="btn-ghost">
            Back to cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-16">
      <div className="panel mx-auto max-w-2xl space-y-6 p-8 sm:p-10">
        <div className="space-y-2 text-center">
          <span
            aria-hidden
            className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/20 text-2xl"
          >
            ✓
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">Thank you — order confirmed</h1>
          <p className="text-sm text-mut">
            Order <span className="font-semibold text-ink">#{order.number}</span>. A confirmation is
            on its way to {order.email}.
          </p>
        </div>

        <ul className="space-y-3 border-y border-line py-5">
          {order.lineItems.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
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
                </p>
              </div>
              <Price
                minor={item.unitPriceMinor * item.quantity}
                currency={order.currency}
                className="text-sm font-semibold"
              />
            </li>
          ))}
        </ul>

        <div className="flex justify-between text-base font-bold">
          <span>Total paid</span>
          <Price minor={order.totalMinor} currency={order.currency} />
        </div>

        <div className="rounded-xl bg-white/5 p-4 text-sm text-mut">
          <p>
            We are placing your order with our supplier now. You will get a tracking number by email
            as soon as it ships — usually within 1–3 business days.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/collections/all" className="btn-ghost">
            Continue shopping
          </Link>
          <Link href={`/orders/track?number=${order.number}`} className="btn-primary">
            Track this order
          </Link>
        </div>
      </div>
    </div>
  );
}
