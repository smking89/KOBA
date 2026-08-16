import { NextResponse } from "next/server";
import { GroupError, groupErrorStatus } from "@/features/groups/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonGroupError(error: unknown, fallback = "Could not complete group action.") {
  if (error instanceof GroupError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: groupErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
