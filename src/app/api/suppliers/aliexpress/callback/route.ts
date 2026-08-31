import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { exchangeCode } from '@/lib/suppliers/aliexpress-api';
import { siteOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * Where AliExpress sends the merchant back after they authorise this app.
 *
 * Admin-only, even though AliExpress is the one redirecting here. The `code`
 * in the URL is single-use and short-lived, but anyone who could reach this
 * endpoint with a code of their own could bind THEIR AliExpress account to
 * this store — and every supplier order would then be placed on it.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(`${siteOrigin()}/admin/login?next=/admin/settings`);
    }
    throw err;
  }

  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const error = params.get('error') ?? params.get('error_description');

  const back = (msg: string) =>
    NextResponse.redirect(`${siteOrigin()}/admin/settings?aliexpress=${encodeURIComponent(msg)}`);

  if (error) return back(`AliExpress declined: ${error}`);
  if (!code) return back('AliExpress sent no authorisation code.');

  try {
    const token = await exchangeCode(code);
    return back(
      `Connected${token.sellerId ? ` as seller ${token.sellerId}` : ''}. Use "Test connection" to confirm.`
    );
  } catch (err) {
    /*
     * The gateway's own words, not a friendly summary. The two likely causes —
     * a wrong signature or a reused code — are only distinguishable from its
     * exact wording, and this is the one moment that wording is available.
     */
    return back(err instanceof Error ? err.message : 'Could not exchange the code.');
  }
}
