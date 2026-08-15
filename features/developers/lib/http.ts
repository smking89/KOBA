import { NextResponse } from "next/server";
import { DeveloperError, developerErrorStatus } from "@/features/developers/lib/errors";
import { WalletError, walletErrorStatus } from "@/features/wallet/lib/errors";
import { staffMfaErrorResponse } from "@/features/staff-mfa/lib/http";
import { unexpectedJsonError } from "@/lib/observability/http";

export const developerNoStore = { "Cache-Control": "no-store" };

export function jsonDeveloper(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: developerNoStore });
}

export function jsonDeveloperError(
  error: unknown,
  fallback = "Could not complete developer action.",
) {
  const mfa = staffMfaErrorResponse(error);
  if (mfa) return mfa;
  if (error instanceof DeveloperError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: developerErrorStatus(error.code), headers: developerNoStore },
    );
  }
  if (error instanceof WalletError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: walletErrorStatus(error.code), headers: developerNoStore },
    );
  }
  return unexpectedJsonError(error, fallback, developerNoStore);
}
