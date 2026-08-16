export const DEV_API_SCOPES = [
  "profile:read",
  "servers:read",
  "products:read",
  "orders:read",
  "webhooks:manage",
] as const;

export type DevApiScope = (typeof DEV_API_SCOPES)[number];

export function isDevApiScope(value: string): value is DevApiScope {
  return (DEV_API_SCOPES as readonly string[]).includes(value);
}

export function assertScopes(requested: string[], allowed: readonly string[]): string[] {
  const unique = [...new Set(requested)];
  for (const scope of unique) {
    if (!isDevApiScope(scope) || !allowed.includes(scope)) {
      throw new Error("INVALID_SCOPE");
    }
  }
  return unique;
}

export function hasScope(granted: readonly string[], required: DevApiScope): boolean {
  return granted.includes(required);
}
