import { NextResponse } from "next/server";
import { StaffMfaError, staffMfaErrorStatus } from "@/features/staff-mfa/lib/errors";
import { emitAlert, recordStaffMfaFailure } from "@/lib/observability/alerts";
import { unexpectedJsonError } from "@/lib/observability/http";

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
  if (error instanceof StaffMfaError && error.code === "INVALID") {
    if (recordStaffMfaFailure() >= 12) {
      void emitAlert("staff_mfa_failure_spike", "Repeated staff MFA failures", {
        labels: { operation: "staff_mfa", errorClass: "authentication" },
      });
    }
  }
  return staffMfaErrorResponse(error) ?? unexpectedJsonError(error, fallback, staffMfaNoStore);
}
