import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { getStoreSettings } from '@/lib/settings';

/**
 * Contact form — delivers a customer message to the support mailbox.
 *
 * The contact page previously promised "we reply to every message" while
 * offering no way to send one. That is worse than having no page: it reads as
 * a support channel and silently is not one.
 *
 * This never reports success for a message that was not accepted by the mail
 * server. If delivery fails the customer is told, and given the address to
 * write to directly, rather than being thanked for a message nobody received.
 */

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1, 'Tell us your name.').max(120),
  email: z.string().email('Enter an email we can reply to.'),
  orderNumber: z.string().max(40).optional(),
  message: z.string().min(10, 'Please give us a little more detail.').max(4000),
  /* Bots fill every field they find; a human never sees this one. */
  website: z.string().max(0).optional(),
});

/*
 * Crude per-IP throttle. In-memory, so it resets when the app restarts and does
 * not span workers — which is fine: it exists to blunt a script hammering the
 * form, not to be an access-control boundary.
 */
const HOUR = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;
const seen = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < HOUR);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 500) {
    for (const [key, times] of seen) if (times.every((t) => now - t >= HOUR)) seen.delete(key);
  }
  return hits.length > MAX_PER_HOUR;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' },
      { status: 400 }
    );
  }

  const { name, email, orderNumber, message, website } = parsed.data;

  // Silently accept the honeypot: telling a bot why it failed only helps it.
  if (website) return NextResponse.json({ ok: true });

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'That is a lot of messages. Please give us a moment to reply first.' },
      { status: 429 }
    );
  }

  const settings = await getStoreSettings();
  const support = settings.supportEmail || 'support@twintitanemporium.com';

  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: `Our contact form is not available right now. Please email us at ${support}.`, support },
      { status: 503 }
    );
  }

  const body = [
    `From:    ${name} <${email}>`,
    orderNumber ? `Order:   ${orderNumber}` : null,
    `IP:      ${ip}`,
    `Sent:    ${new Date().toISOString()}`,
    '',
    message,
  ]
    .filter((line) => line !== null)
    .join('\n');

  try {
    await sendMail({
      to: support,
      // The order number belongs in the subject: it is what makes a support
      // inbox searchable when the customer writes again a week later.
      subject: orderNumber ? `Contact — order ${orderNumber} — ${name}` : `Contact — ${name}`,
      text: body,
      // So a reply goes to the customer, not to the sending address.
      replyTo: email,
    });
  } catch (err) {
    console.error('[contact] delivery failed:', err);
    return NextResponse.json(
      {
        error: `We could not send that just now. Please email us directly at ${support} and we will pick it up.`,
        support,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
