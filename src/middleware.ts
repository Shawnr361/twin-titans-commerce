import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Canonical host, then the admin gate.
 *
 * THE MOVE TO .store
 * ------------------
 * The shop's home is twintitansemporium.store as of 2026-09-01. The old
 * twintitanemporium.com is deliberately kept alive rather than switched off —
 * it is the address in every share image already sent, every WhatsApp link
 * already forwarded, and whatever Google has indexed — so it answers with a
 * permanent redirect here instead of a dead page.
 *
 * WHY /api IS EXCLUDED FROM THE REDIRECT
 * --------------------------------------
 * Payment webhooks POST to a URL configured inside Flutterwave's and PayPal's
 * dashboards, and a 301 turns a POST into a GET in most HTTP clients: the body
 * is dropped and the payment notification is silently lost. Excluding /api
 * means every old .com callback keeps working untouched while those dashboards
 * are re-pointed, so no payment can go unrecorded during the move. Browsers and
 * search engines only ever see page URLs, and those do redirect.
 *
 * The exclusion is done in the matcher rather than with a check in here, so
 * middleware never runs on an API request at all.
 */

/** Where the store actually lives. Empty disables the redirect entirely. */
const CANONICAL_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').host;
  } catch {
    return '';
  }
})();

/*
 * Only these hosts are redirected — never "any host that isn't canonical".
 * A blanket rule would catch localhost during development, the server's own
 * hostname, and any future health check, and each of those would fail in a way
 * that looks like the app is down rather than like a redirect.
 */
const LEGACY_HOSTS = new Set([
  'twintitanemporium.com',
  'www.twintitanemporium.com',
  'www.twintitansemporium.store',
]);

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase() ?? '';

  if (CANONICAL_HOST && host !== CANONICAL_HOST && LEGACY_HOSTS.has(host)) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${CANONICAL_HOST}`
    );
    // 301, not the default 307: this is a permanent move and search engines
    // need to be told so, or the old domain keeps the ranking indefinitely.
    return NextResponse.redirect(target, 301);
  }

  const { pathname } = request.nextUrl;

  // Expose the path to server components (layouts cannot read it otherwise).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const isAdminPage = pathname.startsWith('/admin');
  const isLogin = pathname.startsWith('/admin/login');

  if (isAdminPage && !isLogin) {
    const token = request.cookies.get('tt_admin')?.value;
    let valid = false;

    if (token && process.env.AUTH_SECRET) {
      try {
        await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
        valid = true;
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  /*
   * Every page, so the canonical redirect can catch a visitor landing anywhere
   * on the old domain. Static assets and /api are excluded: assets do not need
   * a redirect, and /api must not have one (see above).
   */
  matcher: ['/((?!_next/static|_next/image|api/|favicon.ico).*)'],
};
