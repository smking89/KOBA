import { NextResponse } from "next/server";
import { StaffMfaError, staffMfaErrorStatus } from "@/features/staff-mfa/lib/errors";

export const staffMfaNoStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export function jsonStaffMfa(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: staffMfaNoStore });
}

export function staffMfaErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof StaffMfaError)) return null;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: staffMfaErrorStatus(error.code), headers: staffMfaNoStore },
  );
}

export function jsonStaffMfaError(error: unknown, fallback = "Could not complete MFA action.") {
  return (
    staffMfaErrorResponse(error) ??
    NextResponse.json({ error: fallback }, { status: 500, headers: staffMfaNoStore })
  );
}
