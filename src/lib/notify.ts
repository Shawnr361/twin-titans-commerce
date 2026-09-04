import { prisma } from '@/lib/db';
import { renderEmail, type EmailItem, type EmailTotal } from '@/lib/email/template';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { getStoreSettings } from '@/lib/settings';
import { siteOrigin } from '@/lib/seo';

/**
 * Customer order emails.
 *
 * Until recently the store sent NONE. Someone paid and heard nothing; their
 * parcel shipped and they heard nothing. That is the single loudest gap for a
 * new shop, because silence after payment is exactly what a scam feels like.
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
 *
 * WHAT THEY LOOK LIKE LIVES IN lib/email/template
 * ----------------------------------------------
 * Every message below describes itself — heading, items, totals, one call to
 * action — and the template turns that into both the HTML and the plain-text
 * alternative. Nothing here composes markup, so the three emails cannot drift
 * apart visually, and the text version cannot drift from the HTML.
 */

/**
 * The customer's own order, on our site.
 *
 * The order NUMBER only. The tracking page needs the number and the email
 * address together — the number is sequential and therefore guessable, so the
 * address is what proves the person asking is the person who ordered. Putting
 * that address in the query string would land it in server logs and browser
 * history to save one field of typing, so the link prefills the number and the
 * customer supplies the address they are reading the email at.
 */
function orderLink(number: number): string {
  return `${siteOrigin()}/orders/track?number=${number}`;
}

function addressLines(raw: unknown): string[] {
  const a = raw as Record<string, string> | null;
  if (!a) return [];
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state].filter(Boolean).join(', '),
    [a.postcode, a.country].filter(Boolean).join(' '),
    a.phone ? `Tel: ${a.phone}` : '',
  ].filter(Boolean);
}

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

    const items: EmailItem[] = order.lineItems.map((l) => ({
      title: l.productTitle,
      variant: l.variantTitle,
      quantity: l.quantity,
      imageUrl: l.imageUrl,
      price: formatMoney(l.unitPriceMinor * l.quantity, order.currency),
    }));

    /*
     * Delivery is shown even when it costs nothing, named "Free" rather than
     * left off. A total that does not visibly add up is the commonest reason a
     * receipt gets queried.
     */
    const totals: EmailTotal[] = [
      { label: 'Subtotal', value: formatMoney(order.subtotalMinor, order.currency) },
      {
        label: 'Delivery',
        value: order.shippingMinor > 0 ? formatMoney(order.shippingMinor, order.currency) : 'Free',
      },
      ...(order.discountMinor > 0
        ? [
            {
              label: order.discountCode ? `Discount (${order.discountCode})` : 'Discount',
              value: `-${formatMoney(order.discountMinor, order.currency)}`,
            },
          ]
        : []),
      { label: 'Total paid', value: formatMoney(order.totalMinor, order.currency), strong: true },
    ];

    const { html, text } = renderEmail({
      storeName: settings.storeName,
      preheader: `Order #${order.number} is confirmed. We are placing it with our supplier now.`,
      heading: `Thank you — order #${order.number} is confirmed`,
      intro: [
        'We have received your payment, and your order is being prepared.',
        'You will get another email with a tracking number as soon as it ships.',
      ],
      items,
      totals,
      cta: { label: 'View your order', href: orderLink(order.number) },
      address: addressLines(order.shippingAddress),
      outro: [
        'Tracking can take a few days to start updating once a parcel is collected, so do not worry if it looks quiet at first.',
      ],
      supportEmail: settings.supportEmail || undefined,
    });

    await sendMail({
      to: order.email,
      /*
       * Sent FROM the no-reply address, but replies go to support.
       *
       * A customer who has just paid will reply to this email to ask where
       * their parcel is — that is not a misuse, it is the first thing anyone
       * does. Sending from no-reply without a Reply-To throws those messages
       * into a mailbox nobody reads.
       */
      from: settings.notificationEmail || settings.supportEmail || undefined,
      replyTo: settings.supportEmail || settings.notificationEmail || undefined,
      subject: `Order #${order.number} confirmed — ${settings.storeName}`,
      text,
      html,
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

/**
 * What a shipment contains, with the pictures.
 *
 * The image and the variant live on the CUSTOMER's line item rather than on
 * the supplier item, so both notices below pull them through the join. A
 * shipping email that names a product without showing it is the one a customer
 * cannot match against what they remember buying.
 */
const shipmentInclude = {
  order: { select: { id: true, number: true, email: true } },
  items: {
    include: {
      orderLineItem: {
        select: { productTitle: true, variantTitle: true, imageUrl: true },
      },
    },
  },
} as const;

interface ShipmentItem {
  quantity: number;
  orderLineItem: { productTitle: string; variantTitle: string; imageUrl: string | null };
}

function shipmentItems(items: ShipmentItem[]): EmailItem[] {
  return items.map((i) => ({
    title: i.orderLineItem.productTitle,
    variant: i.orderLineItem.variantTitle,
    quantity: i.quantity,
    imageUrl: i.orderLineItem.imageUrl,
  }));
}

/** Sent when a supplier shipment first gets a tracking number. */
export async function sendShippingNotice(supplierOrderId: string): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const so = await prisma.supplierOrder.findUnique({
      where: { id: supplierOrderId },
      include: shipmentInclude,
    });
    if (!so?.trackingNumber || !so.order) return;

    const already = await prisma.orderEvent.findFirst({
      where: {
        orderId: so.order.id,
        kind: 'email_shipped',
        message: { contains: so.trackingNumber },
      },
      select: { id: true },
    });
    if (already) return;

    const settings = await getStoreSettings();

    const { html, text } = renderEmail({
      storeName: settings.storeName,
      preheader: `Tracking number ${so.trackingNumber} — your parcel is on its way.`,
      heading: `Your order #${so.order.number} has shipped`,
      intro: ['Good news — this part of your order is on its way to you.'],
      items: shipmentItems(so.items),
      callout: {
        label: 'Tracking',
        lines: [so.trackingNumber, so.trackingCarrier ? `Carrier: ${so.trackingCarrier}` : ''],
      },
      /*
       * The carrier's own page when they gave one, ours otherwise. A customer
       * chasing a parcel wants the carrier, not a form.
       */
      cta: so.trackingUrl
        ? { label: 'Track your parcel', href: so.trackingUrl }
        : { label: 'View your order', href: orderLink(so.order.number) },
      outro: [
        'Tracking can take a few days to start updating after a parcel is collected, so do not worry if it looks quiet at first.',
        'If your order had items from more than one of our suppliers, they travel separately and you will get an email for each.',
      ],
      supportEmail: settings.supportEmail || undefined,
    });

    await sendMail({
      to: so.order.email,
      from: settings.notificationEmail || settings.supportEmail || undefined,
      replyTo: settings.supportEmail || settings.notificationEmail || undefined,
      subject: `Order #${so.order.number} has shipped — ${settings.storeName}`,
      text,
      html,
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

/**
 * The parcel arrived — and the one moment a review is worth asking for.
 *
 * Sent when a shipment reaches DELIVERED, which until recently nothing ever
 * set. It asks for a review deliberately: the store's review system only
 * accepts one from a customer whose shipment was delivered, so this email is
 * both the courtesy and the entire supply of reviews. Asking a week later, out
 * of the blue, gets ignored; asking the day it lands does not.
 *
 * Idempotent on the same rule as the others — one delivery, one email —
 * because a cron that re-reads tracking must not thank someone twice.
 */
export async function sendDeliveryNotice(supplierOrderId: string): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const so = await prisma.supplierOrder.findUnique({
      where: { id: supplierOrderId },
      include: shipmentInclude,
    });
    if (!so?.order) return;

    const already = await prisma.orderEvent.findFirst({
      where: { orderId: so.order.id, kind: 'email_delivered' },
      select: { id: true },
    });
    if (already) return;

    const settings = await getStoreSettings();

    const { html, text } = renderEmail({
      storeName: settings.storeName,
      preheader: 'Your parcel has been delivered. How did we do?',
      heading: `Your order #${so.order.number} has arrived`,
      intro: ['Your parcel has been delivered. We hope it is everything you wanted.'],
      items: shipmentItems(so.items),
      cta: { label: 'Leave a review', href: `${siteOrigin()}/reviews` },
      outro: [
        'A review takes a minute, and on a young shop it is the main thing that helps the next person decide.',
        'If it has not actually reached you, reply to this email and we will chase it — a carrier occasionally marks a parcel delivered a day early.',
      ],
      supportEmail: settings.supportEmail || undefined,
    });

    await sendMail({
      to: so.order.email,
      from: settings.notificationEmail || settings.supportEmail || undefined,
      replyTo: settings.supportEmail || settings.notificationEmail || undefined,
      subject: `Your order #${so.order.number} has arrived — ${settings.storeName}`,
      text,
      html,
    });

    await prisma.orderEvent.create({
      data: {
        orderId: so.order.id,
        kind: 'email_delivered',
        message: `Delivery confirmation emailed to ${so.order.email}.`,
      },
    });
  } catch (err) {
    const so = await prisma.supplierOrder
      .findUnique({ where: { id: supplierOrderId }, select: { orderId: true } })
      .catch(() => null);
    if (so) await recordFailure(so.orderId, 'delivery notice', err);
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
