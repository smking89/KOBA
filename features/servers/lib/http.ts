import { NextResponse } from "next/server";
import { ServerError, serverErrorStatus } from "@/features/servers/lib/errors";

export function jsonServerError(error: unknown, fallback = "Could not complete server action.") {
  if (error instanceof ServerError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: serverErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
