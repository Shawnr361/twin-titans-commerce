import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Admin gate.
 *
 * Runs before any admin page renders, so an unauthenticated request never even
 * reaches a component that could leak order or customer data. `jose` is used
 * rather than the auth helper because middleware runs on the edge runtime,
 * where bcrypt (a native module) is not available — only the JWT check happens
 * here, never a password check.
 */
export async function middleware(request: NextRequest) {
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
  matcher: ['/admin/:path*'],
};
