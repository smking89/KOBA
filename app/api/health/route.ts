import { NextResponse } from "next/server";
import { getLiveness, pingDatabase } from "@/lib/observability/readiness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const database = deep ? await pingDatabase() : "skipped";
  const body = getLiveness(database);
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
