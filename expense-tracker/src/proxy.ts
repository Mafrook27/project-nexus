import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/features/auth/session';

const PUBLIC = ['/login', '/register'];

/**
 * Runs before every page request (Next.js calls this the proxy, formerly
 * middleware).
 *
 * Cheap gate: the cookie's *presence* decides whether to show the app shell.
 * The signature is verified for real on every API call and server component,
 * so a forged cookie gets a signed-out app, not data.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !PUBLIC.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && PUBLIC.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icons|manifest.webmanifest|sw.js|favicon.ico).*)'],
};
