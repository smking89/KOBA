import { NextResponse } from "next/server";
import { emitAlert, bumpWindow } from "@/lib/observability/alerts";
import { captureException } from "@/lib/observability/capture";
import { ERROR_ID_HEADER, REQUEST_ID_HEADER } from "@/lib/observability/config";
import { getObservabilityContext } from "@/lib/observability/context";

export function unexpectedJsonError(
  error: unknown,
  fallback: string,
  extraHeaders?: Record<string, string>,
) {
  const errorId = captureException(error);
  if (bumpWindow("http_5xx") >= 20) {
    void emitAlert("http_5xx_rate", "Elevated 5xx rate", {
      labels: { operation: "http", errorClass: "unexpected" },
    });
  }
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    [ERROR_ID_HEADER]: errorId,
    ...(extraHeaders ?? {}),
  };
  const requestId = getObservabilityContext().requestId;
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  const production = process.env.NODE_ENV === "production";
  return NextResponse.json(
    production ? { error: "Something went wrong.", errorId } : { error: fallback, errorId },
    { status: 500, headers },
  );
}
