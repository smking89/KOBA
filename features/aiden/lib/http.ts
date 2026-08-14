import { NextResponse } from "next/server";
import { AidenError, aidenErrorStatus } from "@/features/aiden/lib/errors";

export function jsonAidenError(error: unknown, fallback = "Could not complete Aiden action.") {
  if (error instanceof AidenError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: aidenErrorStatus(error.code) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
