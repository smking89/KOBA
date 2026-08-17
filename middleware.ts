import { auth } from "@/lib/auth/middleware";
import { isAuthPath, isProtectedPath } from "@/lib/auth/protected-routes";
import { STAFF_ELEVATION_COOKIE } from "@/features/staff-mfa/lib/config";
import { REQUEST_ID_HEADER } from "@/lib/observability/config";
import { resolveRequestId } from "@/lib/observability/request-id";
import { resolveSubdomainRewrite } from "@/lib/subdomain-routes";
import { NextResponse } from "next/server";

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export default auth((request) => {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Phase 20 (Multi-Subdomain Architecture): a request arriving on a
  // recognized *.koba.games subdomain (developer/app/admin/aiden) is
  // served from the existing path-based route that already implements
  // it — everything below (auth gate, admin MFA gate, etc.) runs against
  // this rewritten path, so gating is identical regardless of which host
  // the request came in on.
  const hostname = request.headers.get("host") ?? request.nextUrl.hostname;
  const pathname = resolveSubdomainRewrite(hostname, request.nextUrl.pathname);
  const isSubdomainRewrite = pathname !== request.nextUrl.pathname;
  // /login, /login/mfa, /kobaid, /enter aren't themselves subdomain-
  // mapped — they're the one shared auth session, so any redirect into
  // them from a subdomain request goes to the canonical apex host, not
  // e.g. admin.koba.games/login/mfa (which doesn't exist on that host).
  const redirectOrigin = isSubdomainRewrite
    ? `${request.nextUrl.protocol}//${hostname.replace(/^[a-z0-9-]+\.(koba\.games)(:\d+)?$/i, "$1$2")}`
    : request.nextUrl.origin;

  const isLoggedIn = !!request.auth;
  const isMfaChallenge = pathname === "/login/mfa" || pathname.startsWith("/login/mfa/");

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", redirectOrigin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withRequestId(NextResponse.redirect(loginUrl), requestId);
  }

  if (isLoggedIn && isAuthPath(pathname) && !isMfaChallenge) {
    return withRequestId(NextResponse.redirect(new URL("/enter", redirectOrigin)), requestId);
  }

  if (isLoggedIn && request.auth?.user.kobaIdRevealed === false && pathname !== "/kobaid") {
    if (isProtectedPath(pathname) || pathname === "/") {
      return withRequestId(NextResponse.redirect(new URL("/kobaid", redirectOrigin)), requestId);
    }
  }

  if (isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    if (!request.cookies.get(STAFF_ELEVATION_COOKIE)) {
      const mfaUrl = new URL("/login/mfa", redirectOrigin);
      mfaUrl.searchParams.set("callbackUrl", pathname);
      return withRequestId(NextResponse.redirect(mfaUrl), requestId);
    }
  }

  if (isSubdomainRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return withRequestId(
      NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
      requestId,
    );
  }

  return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline|apple-touch-icon.png).*)",
  ],
};
