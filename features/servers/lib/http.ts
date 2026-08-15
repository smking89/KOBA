import { NextResponse } from "next/server";
import { ServerError, serverErrorStatus } from "@/features/servers/lib/errors";
import { staffMfaErrorResponse } from "@/features/staff-mfa/lib/http";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonServerError(error: unknown, fallback = "Could not complete server action.") {
  const mfa = staffMfaErrorResponse(error);
  if (mfa) return mfa;
  if (error instanceof ServerError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: serverErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
