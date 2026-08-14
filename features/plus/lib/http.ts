import { NextResponse } from "next/server";
import { PlusError, plusErrorStatus } from "@/features/plus/lib/errors";

export function jsonPlusError(error: unknown, fallback = "Could not complete Plus action.") {
  if (error instanceof PlusError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: plusErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
