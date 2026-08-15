import { NextResponse } from "next/server";
import { AdminError, adminErrorStatus } from "@/features/admin/lib/errors";
import { PlusError, plusErrorStatus } from "@/features/plus/lib/errors";

export const plusNoStore = { "Cache-Control": "no-store" };

export function jsonPlus(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: plusNoStore });
}

export function jsonPlusError(error: unknown, fallback = "Could not complete Plus action.") {
  if (error instanceof PlusError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: plusErrorStatus(error.code), headers: plusNoStore },
    );
  }
  if (error instanceof AdminError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: adminErrorStatus(error.code), headers: plusNoStore },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: plusNoStore });
}
