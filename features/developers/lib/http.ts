import { NextResponse } from "next/server";
import { DeveloperError, developerErrorStatus } from "@/features/developers/lib/errors";

export function jsonDeveloperError(
  error: unknown,
  fallback = "Could not complete developer action.",
) {
  if (error instanceof DeveloperError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: developerErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
