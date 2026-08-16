import { auth } from "@/lib/auth/middleware";
import { isAuthPath, isProtectedPath } from "@/lib/auth/protected-routes";
import { STAFF_ELEVATION_COOKIE } from "@/features/staff-mfa/lib/config";
import { REQUEST_ID_HEADER } from "@/lib/observability/config";
import { resolveRequestId } from "@/lib/observability/request-id";
import { NextResponse } from "next/server";

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export default auth((request) => {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth;
  const isMfaChallenge = pathname === "/login/mfa" || pathname.startsWith("/login/mfa/");

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withRequestId(NextResponse.redirect(loginUrl), requestId);
  }

  if (isLoggedIn && isAuthPath(pathname) && !isMfaChallenge) {
    return withRequestId(
      NextResponse.redirect(new URL("/enter", request.nextUrl.origin)),
      requestId,
    );
  }

  if (isLoggedIn && request.auth?.user.kobaIdRevealed === false && pathname !== "/kobaid") {
    if (isProtectedPath(pathname) || pathname === "/") {
      return withRequestId(
        NextResponse.redirect(new URL("/kobaid", request.nextUrl.origin)),
        requestId,
      );
    }
  }

  if (isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    if (!request.cookies.get(STAFF_ELEVATION_COOKIE)) {
      const mfaUrl = new URL("/login/mfa", request.nextUrl.origin);
      mfaUrl.searchParams.set("callbackUrl", pathname);
      return withRequestId(NextResponse.redirect(mfaUrl), requestId);
    }
  }

  return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline|apple-touch-icon.png).*)",
  ],
};
