import { NextResponse } from 'next/server';
import { z } from 'zod';
import { subscribe, unsubscribeUrl } from '@/lib/newsletter';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { getStoreSettings } from '@/lib/settings';
import { siteOrigin } from '@/lib/seo';

const schema = z.object({ email: z.string().email() });

/**
 * Newsletter signup — live.
 *
 * This used to return 501 with "our mailing list opens shortly", because
 * storing an address with no way to email it or remove it would have been a
 * promise the store could not keep. Both halves now exist: the address is kept
 * in our own database, and /unsubscribe withdraws consent.
 *
 * ALWAYS ANSWERS THE SAME
 * -----------------------
 * A valid address gets the same response whether it was new, already on the
 * list, or returning after unsubscribing. The form is public, so varying the
 * reply would let anyone test whether a given person shops here.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  let token: string;
  let isNew: boolean;
  try {
    const result = await subscribe(parsed.data.email);
    token = result.token;
    isNew = result.added || result.resubscribed;
  } catch {
    /*
     * Storing the address is the whole job — if that fails, say so rather than
     * thanking someone for joining a list they are not on.
     */
    return NextResponse.json(
      { error: 'Could not sign you up just now. Please try again shortly.' },
      { status: 500 }
    );
  }

  /*
   * The welcome note is a courtesy, not the signup. It is sent only after the
   * address is safely stored, and its failure is swallowed: a subscriber who
   * never received the welcome is still correctly subscribed, and reporting an
   * error would tell them the opposite of the truth.
   */
  if (isNew && isMailConfigured()) {
    try {
      const settings = await getStoreSettings();
      await sendMail({
        to: parsed.data.email,
        subject: `You are on the list — ${settings.storeName}`,
        text: [
          `Thank you for joining the private view at ${settings.storeName}.`,
          '',
          'You will hear about new arrivals and closed sales before they are public.',
          '',
          'If you did not sign up, or you change your mind at any time, use this',
          'link and you will be removed straight away:',
          unsubscribeUrl(token, siteOrigin()),
          '',
          settings.supportEmail,
        ].join('\n'),
      });
    } catch {
      /* Courtesy only — never fail a stored signup on a mail hiccup. */
    }
  }

  return NextResponse.json({ ok: true });
}
