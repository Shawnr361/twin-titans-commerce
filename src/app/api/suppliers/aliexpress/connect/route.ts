import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { authorizeUrl, isAliexpressConfigured, ping } from '@/lib/suppliers/aliexpress-api';
import { siteOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/** Start the OAuth handshake — sends the admin to AliExpress to authorise. */
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  if (!isAliexpressConfigured()) {
    return NextResponse.json(
      { error: 'ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET are not set on the server.' },
      { status: 503 }
    );
  }

  /*
   * The redirect_uri must match the Callback URL registered on the app exactly
   * — AliExpress compares the strings, so a trailing slash or the wrong host
   * fails with an unhelpful error.
   */
  const redirect = `${siteOrigin()}/api/suppliers/aliexpress/callback`;
  const state = crypto.randomBytes(12).toString('hex');

  return NextResponse.redirect(authorizeUrl(redirect, state));
}

/** Test the stored credentials with a harmless read. */
export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const result = await ping();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
