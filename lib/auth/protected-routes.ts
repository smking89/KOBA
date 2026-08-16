export const PROTECTED_PATH_PREFIXES = [
  "/settings",
  "/kobaid",
  "/enter",
  "/dashboard",
  "/business",
  "/influencer",
  "/seller",
  "/admin",
  "/orders",
  "/messages",
  "/wallet",
  "/servers/connect",
  "/servers/manage",
  "/aiden/generate",
  "/aiden/create",
  "/aiden/library",
  "/aiden/jobs",
  "/developers/new",
  "/developers/dashboard",
  "/developers/applications",
  "/developers/api-keys",
  "/developers/webhooks",
  "/developers/products",
  "/library/apps",
  "/orders/apps",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const AUTH_PATH_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
] as const;

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
