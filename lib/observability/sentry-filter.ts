import { isExpectedNoise, classifyError } from "@/lib/observability/taxonomy";
import { redactHeaders, redactValue } from "@/lib/observability/redact";

const DROP_NAMES = new Set(["ZodError"]);

export function shouldDropError(error: unknown): boolean {
  if (isExpectedNoise(error)) return true;
  if (error && typeof error === "object" && "name" in error) {
    return DROP_NAMES.has(String(error.name));
  }
  return false;
}

export function sentryBeforeSend<
  T extends { extra?: unknown; request?: unknown; breadcrumbs?: unknown },
>(event: T, hint?: { originalException?: unknown }): T | null {
  if (shouldDropError(hint?.originalException)) return null;

  const extra = event.extra;
  if (extra && typeof extra === "object") {
    event.extra = redactValue(extra);
  }

  const request = event.request;
  if (request && typeof request === "object") {
    const req = request as { headers?: unknown; cookies?: unknown; data?: unknown };
    const nextReq: Record<string, unknown> = { ...req };
    if (req.headers && typeof req.headers === "object") {
      nextReq.headers = redactHeaders(req.headers as Record<string, string>);
    }
    if ("cookies" in nextReq) nextReq.cookies = "[Redacted]";
    if ("data" in nextReq) delete nextReq.data;
    event.request = nextReq;
  }

  return event;
}

export function classifyForSentry(error: unknown): string {
  return classifyError(error);
}
