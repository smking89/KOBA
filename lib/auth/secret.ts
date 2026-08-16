/**
 * Resolves AUTH_SECRET for Auth.js init.
 *
 * KOBA-SEC-010: production fails closed when the secret is missing instead of
 * silently signing sessions with an empty string. `next build` (NEXT_PHASE
 * "phase-production-build") gets a placeholder because no real sessions are
 * signed during a build.
 */
export function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "build-phase-placeholder-secret-minimum-32-characters";
    }
    throw new Error(
      "AUTH_SECRET is required in production. Refusing to start with an empty session secret.",
    );
  }

  return "development-fallback-secret-minimum-32-characters";
}
