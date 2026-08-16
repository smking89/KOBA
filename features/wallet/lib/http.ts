import { NextResponse } from "next/server";
import { WalletError, walletErrorStatus } from "@/features/wallet/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonWalletError(error: unknown, fallback = "Could not complete wallet action.") {
  if (error instanceof WalletError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: walletErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
