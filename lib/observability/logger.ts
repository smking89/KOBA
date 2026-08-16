import {
  logLevel,
  observabilityEnvironment,
  observabilityRelease,
  serviceName,
} from "@/lib/observability/config";
import { getObservabilityContext } from "@/lib/observability/context";
import { redactValue } from "@/lib/observability/redact";

export type LogSeverity = "debug" | "info" | "warn" | "error";

export type LogFields = {
  event?: string;
  route?: string;
  operation?: string;
  jobId?: string;
  durationMs?: number;
  outcome?: "success" | "failure" | "degraded" | "skipped" | "inactive";
  errorClass?: string;
  errorId?: string;
  extra?: Record<string, unknown>;
};

const LEVEL_ORDER: Record<LogSeverity, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(severity: LogSeverity): boolean {
  return LEVEL_ORDER[severity] >= LEVEL_ORDER[logLevel()];
}

function serializeError(error: unknown): { name: string; message: string } | undefined {
  if (!error) return undefined;
  const redacted = redactValue(error);
  if (redacted && typeof redacted === "object" && "name" in redacted) {
    return redacted as { name: string; message: string };
  }
  return { name: "Error", message: "unknown" };
}

export function log(
  severity: LogSeverity,
  message: string,
  fields: LogFields = {},
  error?: unknown,
): void {
  if (!shouldLog(severity)) return;
  const context = getObservabilityContext();
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    severity,
    service: serviceName(),
    env: observabilityEnvironment(),
    message,
  };
  const release = observabilityRelease();
  if (release) record.release = release;
  if (context.requestId) record.requestId = context.requestId;
  if (context.correlationId ?? context.requestId) {
    record.correlationId = context.correlationId ?? context.requestId;
  }
  if (fields.route ?? context.route) record.route = fields.route ?? context.route;
  if (fields.operation) record.operation = fields.operation;
  if (fields.jobId ?? context.jobId) record.jobId = fields.jobId ?? context.jobId;
  if (fields.event) record.event = fields.event;
  if (fields.durationMs !== undefined) record.durationMs = fields.durationMs;
  if (fields.outcome) record.outcome = fields.outcome;
  if (fields.errorClass) record.errorClass = fields.errorClass;
  if (fields.errorId ?? context.errorId) record.errorId = fields.errorId ?? context.errorId;
  const serialized = serializeError(error);
  if (serialized) record.error = serialized;
  if (fields.extra) record.extra = redactValue(fields.extra);

  const payload =
    process.env.NODE_ENV === "production" || process.env.KOBA_LOG_JSON === "true"
      ? JSON.stringify(record)
      : `[${record.severity}] ${record.event ?? record.operation ?? "log"} ${message}`;

  if (severity === "error") console.error(payload);
  else if (severity === "warn") console.warn(payload);
  else console.info(payload);
}

export const logger = {
  debug: (message: string, fields: LogFields = {}) => log("debug", message, fields),
  info: (message: string, fields: LogFields = {}) => log("info", message, fields),
  warn: (message: string, fields: LogFields = {}, error?: unknown) =>
    log("warn", message, fields, error),
  error: (message: string, fields: LogFields = {}, error?: unknown) =>
    log("error", message, fields, error),
};
