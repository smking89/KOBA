import { NextResponse } from "next/server";
import {
  MFA_CHALLENGE_TTL_MS,
  STAFF_ELEVATION_COOKIE,
  STAFF_PENDING_COOKIE,
} from "@/features/staff-mfa/lib/config";

function cookieBase() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function applyElevationCookie(response: NextResponse, raw: string, expiresAt: Date) {
  response.cookies.set(STAFF_ELEVATION_COOKIE, raw, {
    ...cookieBase(),
    expires: expiresAt,
  });
}

export function applyPendingCookie(response: NextResponse, raw: string) {
  response.cookies.set(STAFF_PENDING_COOKIE, raw, {
    ...cookieBase(),
    maxAge: Math.ceil(MFA_CHALLENGE_TTL_MS / 1000),
  });
}

export function clearStaffMfaCookies(response: NextResponse) {
  const base = cookieBase();
  response.cookies.set(STAFF_ELEVATION_COOKIE, "", { ...base, maxAge: 0 });
  response.cookies.set(STAFF_PENDING_COOKIE, "", { ...base, maxAge: 0 });
}

export function clearPendingCookie(response: NextResponse) {
  response.cookies.set(STAFF_PENDING_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}
