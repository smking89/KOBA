import { NextResponse } from "next/server";
import { BoostError } from "@/features/boost/services/boost.service";

export function boostErrorStatus(code: BoostError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "INSUFFICIENT":
      return 402;
    case "INVALID":
    default:
      return 400;
  }
}

export function jsonBoostError(error: unknown, fallback = "Could not complete Boost action.") {
  if (error instanceof BoostError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: boostErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
