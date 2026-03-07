// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const TOKEN_KEY = "cb_token";

// Requires a valid token cookie to access
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/repl",
  "/settings",
  "/billing",
];

// Logged-in users should not see these — send them to dashboard instead
// /auth/callback is intentionally excluded: it needs to run even with a
// cookie present (e.g. linking a second OAuth provider, or a stale cookie
// from a different account). The callback page handles its own logic.
const REDIRECT_IF_AUTHED = [
  "/signin",
  "/signup",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(TOKEN_KEY)?.value;

  // 1. Protected route — no token → redirect to signin, preserve destination
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Auth pages — already logged in → redirect to dashboard
  // Does NOT include /auth/callback — that page must be reachable always
  const shouldRedirect = REDIRECT_IF_AUTHED.some((p) => pathname.startsWith(p));
  if (shouldRedirect && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search   = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|images).*)"],
};