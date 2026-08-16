import { NextResponse } from "next/server";
import { SocialError, socialErrorStatus } from "@/features/social/lib/errors";
import { unexpectedJsonError } from "@/lib/observability/http";

export function jsonSocialError(error: unknown, fallback = "Could not complete social action.") {
  if (error instanceof SocialError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: socialErrorStatus(error.code) },
    );
  }
  return unexpectedJsonError(error, fallback);
}
