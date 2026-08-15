import { NextResponse } from "next/server";
import { MessageError, messageErrorStatus } from "@/features/messages/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonMessageError(
  error: unknown,
  fallback = "Could not complete messaging action.",
) {
  if (error instanceof MessageError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: messageErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
