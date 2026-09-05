import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { renderEmail } from '@/lib/email/template';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Prove the store can still send, using the sender that is actually configured.
 *
 * WHY THIS IS WORTH A ROUTE
 * -------------------------
 * The envelope sender has to be a mailbox the mail server can verify. Exim
 * answers "550 Sender verify failed" for one it cannot resolve, and it fails
 * CLOSED — not the one message, every message. That is how orders #17 and #18
 * were paid for and confirmed nothing.
 *
 * So changing "Send automatic emails from" is a change that can silently break
 * every order email, and until now the only way to find out was for a real
 * customer to pay and hear nothing. This sends one message through exactly the
 * same path an order confirmation takes — same from, same reply-to, same
 * transport — and reports what came back.
 *
 * IT ONLY EVER EMAILS THE ADMIN
 * -----------------------------
 * The recipient is the signed-in admin's own address, never a value from the
 * request. A test endpoint that accepts a destination is a way to send mail
 * from someone else's domain to anywhere, which is worth avoiding even behind
 * a login.
 */
export async function POST() {
  let session;
  try {
    session = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  if (!isMailConfigured()) {
    return NextResponse.json({ ok: false, detail: 'No mail transport is configured.' });
  }

  const settings = await getStoreSettings();
  const from = settings.notificationEmail || settings.supportEmail || undefined;
  const replyTo = settings.supportEmail || settings.notificationEmail || undefined;

  const { html, text } = renderEmail({
    storeName: settings.storeName,
    preheader: 'Checking that order emails can still leave the building.',
    heading: 'Your store can send email',
    intro: [
      'This is a test from the admin, sent through the same path an order confirmation uses.',
      `It was sent from ${from ?? '(no sender configured)'}, and replies go to ${replyTo ?? '(none)'}.`,
    ],
    outro: [
      'If this arrived, the configured sender is one the mail server accepts, and order confirmations, shipping notices and delivery emails will send too.',
    ],
    supportEmail: settings.supportEmail || undefined,
  });

  try {
    await sendMail({
      to: session.email,
      from,
      replyTo,
      subject: `Mail test — ${settings.storeName}`,
      text,
      html,
    });
    return NextResponse.json({
      ok: true,
      sentTo: session.email,
      from: from ?? '(default)',
      detail: 'Accepted by the mail server. Check the inbox to confirm delivery.',
    });
  } catch (err) {
    /*
     * Raw, because the wording is the diagnosis: "Sender verify failed" means
     * the from address does not exist, "relay not permitted" means the
     * transport is wrong, and they need opposite fixes.
     */
    return NextResponse.json({
      ok: false,
      from: from ?? '(default)',
      detail: err instanceof Error ? err.message : 'Unknown mail failure.',
    });
  }
}
