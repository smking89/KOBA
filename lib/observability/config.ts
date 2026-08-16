export const OBSERVABILITY_SERVICE = "koba";
export const REQUEST_ID_HEADER = "x-request-id";
export const ERROR_ID_HEADER = "x-koba-error-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function serviceName(): string {
  const configured = process.env.KOBA_SERVICE_NAME?.trim();
  return configured && configured.length <= 64 ? configured : OBSERVABILITY_SERVICE;
}

export function observabilityEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
}

export function observabilityRelease(): string | undefined {
  const release = process.env.SENTRY_RELEASE?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  return release && release.length <= 128 ? release : undefined;
}

export function logLevel(): "debug" | "info" | "warn" | "error" {
  const raw = (process.env.KOBA_LOG_LEVEL ?? "info").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

export function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function dsnLooksReal(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("replace") || trimmed.endsWith("_me")) return false;
  return trimmed.startsWith("https://");
}

export function isSentryEnabled(): boolean {
  if (isTestEnv()) return false;
  if (process.env.SENTRY_ENABLED === "false") return false;
  return dsnLooksReal(process.env.SENTRY_DSN) || dsnLooksReal(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function sentryDsn(): string | undefined {
  if (!isSentryEnabled()) return undefined;
  if (dsnLooksReal(process.env.SENTRY_DSN)) return process.env.SENTRY_DSN.trim();
  if (dsnLooksReal(process.env.NEXT_PUBLIC_SENTRY_DSN)) {
    return process.env.NEXT_PUBLIC_SENTRY_DSN.trim();
  }
  return undefined;
}

export function sentryTraceSampleRate(): number {
  const raw = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");
  if (!Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}
