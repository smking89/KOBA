import { NextResponse } from "next/server";
import { SocialError, socialErrorStatus } from "@/features/social/lib/errors";

export function jsonSocialError(error: unknown, fallback = "Could not complete social action.") {
  if (error instanceof SocialError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: socialErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
