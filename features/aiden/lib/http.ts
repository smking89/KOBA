import { NextResponse } from "next/server";
import { AidenError, aidenErrorStatus } from "@/features/aiden/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export const aidenNoStore = { "Cache-Control": "no-store" };

export function jsonAiden(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: aidenNoStore });
}

export function jsonAidenError(error: unknown, fallback = "Could not complete Aiden action.") {
  if (error instanceof AidenError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: aidenErrorStatus(error.code), headers: aidenNoStore },
    );
  }
  return unexpectedJsonError(error, fallback, aidenNoStore);
}
