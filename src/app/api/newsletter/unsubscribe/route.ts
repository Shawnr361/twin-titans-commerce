import { NextResponse } from 'next/server';
import { z } from 'zod';
import { unsubscribeByToken } from '@/lib/newsletter';

const schema = z.object({ token: z.string().min(8) });

/**
 * Withdraw marketing consent.
 *
 * POST, not GET, even though the link in the email is a GET.
 *
 * Corporate mail filters, link scanners and browser prefetchers routinely fetch
 * every URL in a message before a human sees it. A GET that unsubscribes would
 * therefore remove people who never clicked anything — and they would only find
 * out by noticing they had stopped hearing from us. So the emailed link opens a
 * page with a button, and only the button reaches this handler.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 });
  }

  try {
    const result = await unsubscribeByToken(parsed.data.token);
    if (!result) {
      return NextResponse.json({ error: 'That link is not valid or has expired.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, email: result.email });
  } catch {
    return NextResponse.json(
      { error: 'Could not remove you just now. Please email us and we will do it by hand.' },
      { status: 500 }
    );
  }
}
