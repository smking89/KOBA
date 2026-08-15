import { logger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/capture";

export const ALERT_EVENTS = [
  "http_5xx_rate",
  "readiness_failure",
  "database_failure",
  "redis_failure",
  "worker_heartbeat_missing",
  "queue_backlog",
  "job_terminal_failure",
  "stripe_signature_rejected",
  "stripe_webhook_failure",
  "payment_reconciliation_mismatch",
  "refund_failure",
  "ledger_invariant_failure",
  "staff_mfa_failure_spike",
  "rcon_failure_spike",
  "storage_failure",
  "backup_failure_placeholder",
] as const;

export type AlertEvent = (typeof ALERT_EVENTS)[number];

const ALLOWED_LABEL_KEYS = new Set(["worker", "operation", "provider", "outcome", "errorClass"]);

function boundLabels(labels: Record<string, string> | undefined): Record<string, string> {
  const output: Record<string, string> = {};
  if (!labels) return output;
  for (const [key, value] of Object.entries(labels)) {
    if (!ALLOWED_LABEL_KEYS.has(key)) continue;
    output[key] = value.slice(0, 64);
  }
  return output;
}

const windows = new Map<string, number[]>();

export function bumpWindow(key: string, now = Date.now(), windowMs = 60_000): number {
  const existing = windows.get(key) ?? [];
  const next = existing.filter((ts) => now - ts < windowMs);
  next.push(now);
  windows.set(key, next);
  return next.length;
}

export async function emitAlert(
  event: AlertEvent,
  message: string,
  options?: { labels?: Record<string, string>; error?: unknown; extra?: Record<string, unknown> },
): Promise<void> {
  const labels = boundLabels(options?.labels);
  logger.error(
    message,
    {
      event,
      extra: { labels, ...(options?.extra ?? {}) },
      outcome: "failure",
      ...(labels.errorClass ? { errorClass: labels.errorClass } : {}),
      ...(labels.operation ? { operation: labels.operation } : {}),
    },
    options?.error,
  );

  if (event === "backup_failure_placeholder") {
    logger.warn("Backup alerts are placeholders until Phase 15E implements backups.", {
      event: "backup_alert_deferred",
    });
    return;
  }

  if (options?.error) {
    captureException(options.error, { operation: event, route: event, skipLog: true });
  }
}

export function recordStaffMfaFailure(): number {
  return bumpWindow("staff_mfa_failure");
}

export function recordRconFailure(): number {
  return bumpWindow("rcon_failure");
}

export function resetAlertWindowsForTests(): void {
  windows.clear();
}
