import { prisma } from '@/lib/db';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { getStoreSettings } from '@/lib/settings';
import { siteOrigin } from '@/lib/seo';

/**
 * Customer order emails.
 *
 * Until now the store sent NONE. Someone paid and heard nothing; their parcel
 * shipped and they heard nothing. That is the single loudest gap for a new
 * shop, because silence after payment is exactly what a scam feels like.
 *
 * WHY PAYMENT, NOT THE THANK-YOU PAGE, IS THE TRIGGER
 * --------------------------------------------------
 * The obvious hook is the confirmation screen, but a customer can close the
 * tab, lose signal on the redirect back, or pay and never return — and then
 * they get no email for an order we were paid for. The webhook is already the
 * authoritative payment signal in this codebase (it is what marks the order
 * PAID and queues the supplier), so the email hangs off that instead. It fires
 * whether or not anyone ever loads the thank-you page.
 *
 * EVERY SEND IS NON-FATAL
 * -----------------------
 * A mail failure must never roll back a payment or block supplier routing.
 * These functions swallow their own errors and record the outcome as an
 * OrderEvent, so a missing email is visible in the order history rather than
 * silently lost.
 */

/** Sent once, from the payment webhook. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: { lineItems: true },
      }),
      getStoreSettings(),
    ]);
    if (!order) return;

    // Never send twice — a webhook can legitimately arrive more than once.
    const already = await prisma.orderEvent.findFirst({
      where: { orderId, kind: 'email_confirmation' },
      select: { id: true },
    });
    if (already) return;

    const lines = order.lineItems
      .map(
        (l) =>
          `  ${l.quantity} x ${l.productTitle.slice(0, 70)}` +
          (l.variantTitle && l.variantTitle !== 'Default' ? ` (${l.variantTitle})` : '')
      )
      .join('\n');

    await sendMail({
      to: order.email,
      from: settings.supportEmail || undefined,
      replyTo: settings.supportEmail || undefined,
      subject: `Order #${order.number} confirmed — ${settings.storeName}`,
      text: [
        `Thank you — we have received your payment for order #${order.number}.`,
        '',
        'What you ordered:',
        lines,
        '',
        `Total paid: ${formatMoney(order.totalMinor, order.currency)}`,
        '',
        'Delivering to:',
        formatAddress(order.shippingAddress),
        '',
        'We are placing your order with our supplier now. You will get another',
        'email with a tracking number as soon as it ships.',
        '',
        `Track your order any time: ${siteOrigin()}/orders/track`,
        `(you will need order number ${order.number} and this email address)`,
        '',
        settings.supportEmail ? `Questions? Reply to this email or write to ${settings.supportEmail}.` : '',
        settings.storeName,
      ]
        .filter((l) => l !== undefined)
        .join('\n'),
    });

    await prisma.orderEvent.create({
      data: {
        orderId,
        kind: 'email_confirmation',
        message: `Order confirmation emailed to ${order.email}.`,
      },
    });
  } catch (err) {
    await recordFailure(orderId, 'confirmation', err);
  }
}

/** Sent when a supplier shipment first gets a tracking number. */
export async function sendShippingNotice(supplierOrderId: string): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const so = await prisma.supplierOrder.findUnique({
      where: { id: supplierOrderId },
      include: {
        order: { select: { id: true, number: true, email: true } },
        items: { include: { orderLineItem: { select: { productTitle: true } } } },
      },
    });
    if (!so?.trackingNumber || !so.order) return;

    const already = await prisma.orderEvent.findFirst({
      where: { orderId: so.order.id, kind: 'email_shipped', message: { contains: so.trackingNumber } },
      select: { id: true },
    });
    if (already) return;

    const settings = await getStoreSettings();
    const what = so.items
      .map((i) => `  ${i.quantity} x ${i.orderLineItem.productTitle.slice(0, 70)}`)
      .join('\n');

    await sendMail({
      to: so.order.email,
      from: settings.supportEmail || undefined,
      replyTo: settings.supportEmail || undefined,
      subject: `Order #${so.order.number} has shipped — ${settings.storeName}`,
      text: [
        `Good news — part of your order #${so.order.number} is on its way.`,
        '',
        what,
        '',
        `Tracking number: ${so.trackingNumber}`,
        so.trackingCarrier ? `Carrier: ${so.trackingCarrier}` : '',
        so.trackingUrl ? `Track it here: ${so.trackingUrl}` : '',
        '',
        /*
         * Said plainly because it is the commonest support question: tracking
         * often shows nothing for days after it is issued.
         */
        'Tracking can take a few days to start updating after a parcel is',
        'collected, so do not worry if it looks quiet at first.',
        '',
        `All your order details: ${siteOrigin()}/orders/track`,
        '',
        settings.storeName,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    await prisma.orderEvent.create({
      data: {
        orderId: so.order.id,
        kind: 'email_shipped',
        message: `Shipping notice emailed to ${so.order.email} with tracking ${so.trackingNumber}.`,
      },
    });
  } catch (err) {
    const so = await prisma.supplierOrder
      .findUnique({ where: { id: supplierOrderId }, select: { orderId: true } })
      .catch(() => null);
    if (so) await recordFailure(so.orderId, 'shipping notice', err);
  }
}

async function recordFailure(orderId: string, kind: string, err: unknown): Promise<void> {
  try {
    await prisma.orderEvent.create({
      data: {
        orderId,
        kind: 'email_failed',
        message: `Could not send ${kind}: ${err instanceof Error ? err.message : 'unknown error'}`,
      },
    });
  } catch {
    /* If even the audit write fails there is nothing further to try. */
  }
}

function formatAddress(raw: unknown): string {
  const a = raw as Record<string, string> | null;
  if (!a) return '  (no address on file)';
  return [a.name, a.line1, a.line2, a.city, a.state, a.postcode, a.country]
    .filter(Boolean)
    .map((l) => `  ${l}`)
    .join('\n');
}
