import { auth } from "@/lib/auth/middleware";
import { isAuthPath, isProtectedPath } from "@/lib/auth/protected-routes";
import { NextResponse } from "next/server";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth;

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline|apple-touch-icon.png).*)",
  ],
};
