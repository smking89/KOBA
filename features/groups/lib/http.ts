import { NextResponse } from "next/server";
import { GroupError, groupErrorStatus } from "@/features/groups/lib/errors";

export function jsonGroupError(error: unknown, fallback = "Could not complete group action.") {
  if (error instanceof GroupError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: groupErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
