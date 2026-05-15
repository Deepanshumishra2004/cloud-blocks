import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Routes that require a valid session cookie to access.
const PROTECTED_PREFIXES = ["/dashboard", "/repl"];

// Cookie name must match what the backend sets in buildAuthCookieOptions().
const SESSION_COOKIE = "cb_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    // Preserve the intended destination so post-login redirect works.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
