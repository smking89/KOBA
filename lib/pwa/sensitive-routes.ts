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
  "/api/market/favorites",
  "/api/shops",
  "/api/business",
  "/api/auctions",
  "/api/groups",
  "/api/lfg",
  "/api/social",
  "/api/media",
  "/api/wallet",
  "/api/trade",
  "/api/inventory",
  "/api/servers",
  "/api/account",
  "/api/plus",
  "/api/aiden",
  "/api/developers",
  "/api/apps",
  "/api/v1",
  "/api/influencer",
  "/api/seller",
  "/api/promo",
  "/api/ads",
] as const;

export function isSensitivePath(pathname: string): boolean {
  return NEVER_CACHE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Authenticated document routes that must never be written to the service
 * worker page cache (KOBA-PWA-001). A shared or stolen device must not be
 * able to replay wallet, DM, order, admin, or seller HTML from Cache Storage
 * after logout.
 */
export const SENSITIVE_DOCUMENT_PREFIXES = [
  "/admin",
  "/wallet",
  "/messages",
  "/orders",
  "/settings",
  "/dashboard",
  "/business",
  "/influencer",
  "/seller",
  "/developers",
  "/library",
  "/trade",
  "/kobaid",
  "/enter",
  "/aiden",
  "/plus",
  "/servers/connect",
  "/servers/manage",
] as const;

export function isSensitiveDocumentPath(pathname: string): boolean {
  return SENSITIVE_DOCUMENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Runtime page-cache name. Bump the suffix when caching rules change. */
export const PAGES_CACHE_NAME = "koba-pages-v2";

/** Older runtime caches deleted on service-worker activation. */
export const LEGACY_PAGE_CACHES = ["koba-pages"] as const;

/**
 * Dynamic app surfaces that should prefer fresh network data.
 */
export const NETWORK_FIRST_PATH_PREFIXES = [
  "/market",
  "/shops",
  "/business",
  "/feed",
  "/u",
  "/stories",
  "/groups",
  "/lfg",
  "/messages",
  "/settings",
  "/orders",
  "/trade",
  "/servers",
  "/aiden",
  "/plus",
  "/wallet",
  "/developers",
  "/apps",
  "/library/apps",
  "/influencer",
  "/seller",
  "/promo",
  "/api/",
] as const;

export function prefersNetworkFirst(pathname: string): boolean {
  if (isSensitivePath(pathname)) return true;
  return NETWORK_FIRST_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
