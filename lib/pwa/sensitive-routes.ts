/**
 * Paths that must never be cached by the service worker.
 * Extend as auth, messaging, and payment APIs are added.
 */
export const NEVER_CACHE_PATH_PREFIXES = [
  "/api/auth",
  "/api/messages",
  "/api/stripe",
  "/api/payments",
  "/api/webhooks",
  "/api/checkout",
  "/api/orders",
  "/api/accounts",
  "/api/admin",
] as const;

export function isSensitivePath(pathname: string): boolean {
  return NEVER_CACHE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Dynamic app surfaces that should prefer fresh network data.
 */
export const NETWORK_FIRST_PATH_PREFIXES = [
  "/market",
  "/feed",
  "/groups",
  "/lfg",
  "/messages",
  "/settings",
  "/api/",
] as const;

export function prefersNetworkFirst(pathname: string): boolean {
  if (isSensitivePath(pathname)) return true;
  return NETWORK_FIRST_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
