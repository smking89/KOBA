/**
 * Browser-safe Sentry flags. Reads only NEXT_PUBLIC_* so the client bundle
 * never inlines server tokens (SENTRY_AUTH_TOKEN, SENTRY_DSN).
 */
export function isBrowserSentryEnabled(): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") return false;
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "false") return false;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn || dsn.includes("replace") || dsn.endsWith("_me")) return false;
  return dsn.startsWith("https://");
}

export function browserSentryDsn(): string | undefined {
  if (!isBrowserSentryEnabled()) return undefined;
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
}
