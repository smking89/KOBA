import { auth } from "@/lib/auth/middleware";
import { isAuthPath, isProtectedPath } from "@/lib/auth/protected-routes";
import { STAFF_ELEVATION_COOKIE } from "@/features/staff-mfa/lib/config";
import { NextResponse } from "next/server";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth;
  const isMfaChallenge = pathname === "/login/mfa" || pathname.startsWith("/login/mfa/");

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPath(pathname) && !isMfaChallenge) {
    return NextResponse.redirect(new URL("/enter", request.nextUrl.origin));
  }

  if (isLoggedIn && request.auth?.user.kobaIdRevealed === false && pathname !== "/kobaid") {
    if (isProtectedPath(pathname) || pathname === "/") {
      return NextResponse.redirect(new URL("/kobaid", request.nextUrl.origin));
    }
  }

  if (isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    if (!request.cookies.get(STAFF_ELEVATION_COOKIE)) {
      const mfaUrl = new URL("/login/mfa", request.nextUrl.origin);
      mfaUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(mfaUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline|apple-touch-icon.png).*)",
  ],
};
