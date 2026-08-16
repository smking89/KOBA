import { NextResponse } from "next/server";
import { emitAlert } from "@/lib/observability/alerts";
import { getReadiness } from "@/lib/observability/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await getReadiness();
  if (!body.ready) {
    await emitAlert("readiness_failure", "Readiness check failed", {
      labels: {
        operation: "ready",
        errorClass: body.checks.database === "error" ? "database" : "unexpected",
      },
    });
    if (body.checks.database === "error") {
      await emitAlert("database_failure", "Readiness database ping failed", {
        labels: { operation: "ready", errorClass: "database" },
      });
    }
    if (body.checks.redis === "error") {
      await emitAlert("redis_failure", "Readiness Redis ping failed", {
        labels: { operation: "ready", errorClass: "redis" },
      });
    }
  }
  return NextResponse.json(body, {
    status: body.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
