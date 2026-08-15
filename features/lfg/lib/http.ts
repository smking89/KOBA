import { NextResponse } from "next/server";
import { LfgError, lfgErrorStatus } from "@/features/lfg/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonLfgError(error: unknown, fallback = "Could not complete LFG action.") {
  if (error instanceof LfgError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: lfgErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
