/** Resolves AUTH_SECRET for Auth.js init (build-safe fallback for CI/local). */
export function resolveAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? ""
      : "development-fallback-secret-minimum-32-characters")
  );
}
