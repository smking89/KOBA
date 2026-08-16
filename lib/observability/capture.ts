import { NextResponse } from "next/server";
import { ERROR_ID_HEADER, REQUEST_ID_HEADER, isSentryEnabled } from "@/lib/observability/config";
import { getObservabilityContext, markCaptured, wasCaptured } from "@/lib/observability/context";
import { logger } from "@/lib/observability/logger";
import { newErrorId } from "@/lib/observability/request-id";
import { shouldDropError } from "@/lib/observability/sentry-filter";
import { classifyError, isExpectedNoise } from "@/lib/observability/taxonomy";

type CaptureOptions = {
  route?: string;
  operation?: string;
  skipLog?: boolean;
};

export function captureException(error: unknown, options: CaptureOptions = {}): string {
  const ctx = getObservabilityContext();
  const errorId = ctx.errorId ?? newErrorId();
  if (!ctx.errorId && ctx !== undefined) {
    ctx.errorId = errorId;
  }
  const category = classifyError(error);
  const drop = shouldDropError(error);
  const already = wasCaptured();

  if (!already && !options.skipLog) {
    const logFn = drop ? logger.warn : logger.error;
    logFn(
      drop ? "Expected error" : "Unexpected failure",
      {
        event: drop ? "expected_error" : "unexpected_error",
        errorClass: category,
        errorId,
        outcome: "failure",
        ...(options.route ? { route: options.route } : {}),
        ...(options.operation ? { operation: options.operation } : {}),
      },
      error,
    );
  }

  if (!already && !drop && isSentryEnabled()) {
    void import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.withScope((scope) => {
          scope.setTag("errorId", errorId);
          scope.setTag("errorClass", category);
          if (ctx.requestId) scope.setTag("requestId", ctx.requestId);
          if (ctx.correlationId) scope.setTag("correlationId", ctx.correlationId);
          Sentry.captureException(error);
        });
      })
      .catch(() => {
        // Package unavailable — logger already recorded the failure.
      });
  }

  markCaptured();
  return errorId;
}

export function safeErrorJson(
  errorId: string,
  exposeMessage: string | undefined,
  production: boolean,
) {
  if (!production && exposeMessage) {
    return { error: exposeMessage, errorId };
  }
  return { error: "Something went wrong.", errorId };
}

export function safeErrorResponse(
  error: unknown,
  options: CaptureOptions & { status?: number } = {},
): NextResponse {
  const errorId = captureException(error, options);
  const category = classifyError(error);
  const status =
    options.status ??
    (error instanceof Error && "status" in error && typeof error.status === "number"
      ? error.status
      : category === "validation"
        ? 400
        : 500);
  const production = process.env.NODE_ENV === "production";
  const expose = isExpectedNoise(error) && error instanceof Error ? error.message : undefined;
  const requestId = getObservabilityContext().requestId;
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    [ERROR_ID_HEADER]: errorId,
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return NextResponse.json(safeErrorJson(errorId, expose, production), { status, headers });
}
