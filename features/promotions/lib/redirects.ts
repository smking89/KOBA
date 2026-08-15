const ALLOWED_PREFIXES = ["/market/", "/shops/", "/apps/", "/servers/"] as const;
const ALLOWED_EXACT = ["/market", "/shops", "/apps", "/servers"] as const;

export function isSafeInternalPath(path: string): boolean {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("://")
  ) {
    return false;
  }
  const [pathname] = path.split("?");
  if (!pathname) return false;
  if (pathname.includes("..")) return false;
  return (
    ALLOWED_EXACT.includes(pathname as (typeof ALLOWED_EXACT)[number]) ||
    ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function sanitizeRedirectPath(path: string, fallback = "/market"): string {
  return isSafeInternalPath(path) ? path : fallback;
}

export function productRedirectPath(slug: string): string {
  return `/market/${encodeURIComponent(slug)}`;
}
