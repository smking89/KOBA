import { getPublicEnv } from "@/lib/env";

export const PLUS_RETURN_PATHS = {
  processing: "/plus?checkout=processing",
  cancelled: "/plus?checkout=cancelled",
  portal: "/plus",
} as const;

const ALLOWED_PATHS = new Set<string>(Object.values(PLUS_RETURN_PATHS));

export function plusAppUrl(path: string): string {
  const base = getPublicEnv().appUrl.replace(/\/$/, "");
  if (!path.startsWith("/plus")) {
    throw new Error("Plus return path is not allowlisted.");
  }
  const pathname = path.split("?")[0] ?? path;
  const allowed = [...ALLOWED_PATHS].some((entry) => entry.split("?")[0] === pathname);
  if (!allowed) {
    throw new Error("Plus return path is not allowlisted.");
  }
  return `${base}${path}`;
}

export function isAllowlistedPlusReturnPath(value: string): boolean {
  try {
    if (value.startsWith("/")) {
      return value.startsWith("/plus");
    }
    const url = new URL(value);
    const app = new URL(getPublicEnv().appUrl);
    if (url.origin !== app.origin) return false;
    return url.pathname === "/plus" || url.pathname.startsWith("/plus/");
  } catch {
    return false;
  }
}

export function rejectArbitraryReturnUrl(value: string | undefined): void {
  if (value == null) return;
  if (!isAllowlistedPlusReturnPath(value)) {
    throw new Error("OPEN_REDIRECT");
  }
}
