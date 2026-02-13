
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Enterprise Middleware for Route Protection.
 * Blocks access to all core modules if no auth session cookie is present.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('auth_session');

  // Define protected route prefixes
  const protectedPrefixes = [
    '/dashboard',
    '/users',
    '/roles',
    '/assignments',
    '/groups',
    '/lifecycle',
    '/reviews',
    '/processhub',
    '/gdpr',
    '/risks',
    '/itsechub',
    '/audit',
    '/features',
    '/tasks',
    '/settings',
    '/access',
    '/iam-audit',
    '/help'
  ];

  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));
  const isLoginPage = pathname === '/';

  // 1. Redirect unauthorized users to login
  if (isProtectedRoute && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 2. Redirect logged-in users away from login page
  if (isLoginPage && session) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Configure which paths the middleware runs on.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - setup-wizard (allow initial setup)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|setup-wizard).*)',
  ],
};
