import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { renderEmail } from '@/lib/email/template';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Write to one customer, in the store's own email design.
 *
 * WHY NOT JUST USE THE SUPPORT MAILBOX
 * ------------------------------------
 * The black-and-gold design exists only in renderEmail. A message written in
 * webmail — or in Gmail sending as support@ — goes out in that editor's plain
 * styling, and pasting the design in does not survive: those editors strip the
 * tables and inline styles it is built from. Sending through the same path as
 * an order confirmation is the only way the design is guaranteed to arrive, and
 * it is the path already proven in Gmail web and Gmail's iPhone dark mode.
 *
 * ONE RECIPIENT, ON PURPOSE
 * -------------------------
 * This is for writing to a customer, not for campaigns. Bulk marketing needs
 * each subscriber's own unsubscribe link and their recorded consent (the
 * privacy policy promises marketing only "with your consent"), and sending
 * hundreds of messages from the shop's own server is the quickest way to get
 * its mail — order confirmations included — marked as spam.
 *
 *   mode "preview" returns the HTML, sends nothing
 *   mode "test"    sends to the signed-in admin only
 *   mode "send"    sends to `to`
 */
const schema = z.object({
  mode: z.enum(['preview', 'test', 'send']),
  to: z.string().trim().email().max(254).optional(),
  subject: z.string().trim().min(1).max(150),
  heading: z.string().trim().min(1).max(120),
  /** Blank lines separate paragraphs. */
  message: z.string().trim().min(1).max(5000),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https:\/\//i.test(v), 'The button link must start with https://')
    .optional(),
});

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'request'}: ${issue.message}` : 'Invalid request.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const settings = await getStoreSettings();
  const from = settings.notificationEmail || settings.supportEmail || undefined;
  const replyTo = settings.supportEmail || settings.notificationEmail || undefined;

  const paragraphs = input.message
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

  const cta =
    input.ctaLabel && input.ctaHref ? { label: input.ctaLabel, href: input.ctaHref } : null;

  const { html, text } = renderEmail({
    storeName: settings.storeName,
    preheader: paragraphs[0]?.slice(0, 110) ?? input.heading,
    heading: input.heading,
    intro: paragraphs,
    cta,
    supportEmail: settings.supportEmail || undefined,
  });

  if (input.mode === 'preview') return NextResponse.json({ ok: true, html, from, replyTo });

  if (!isMailConfigured()) {
    return NextResponse.json({ ok: false, error: 'No mail transport is configured.' });
  }

  const recipient = input.mode === 'test' ? session.email : input.to;
  if (!recipient) {
    return NextResponse.json({ ok: false, error: 'Enter the customer’s email address.' }, { status: 400 });
  }

  try {
    await sendMail({
      to: recipient,
      from,
      replyTo,
      subject: input.mode === 'test' ? `[Test] ${input.subject}` : input.subject,
      text,
      html,
    });
    return NextResponse.json({ ok: true, sentTo: recipient, from: from ?? '(default)' });
  } catch (err) {
    // Raw, because the mail server's wording is the diagnosis.
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown mail failure.',
    });
  }
}
