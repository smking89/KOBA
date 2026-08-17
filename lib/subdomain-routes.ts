/**
 * Phase 20 (Multi-Subdomain Architecture) — MVP per the roadmap's own
 * recommended default: a middleware-based rewrite within this single
 * deployment (option 1), not genuinely separate apps per subdomain
 * (option 2). `admin.koba.games` warranting its own deployment/security
 * perimeter is still an open question (ROADMAP.md Phase 20) — this
 * rewrite is the working default for all four subdomains until that's
 * decided, not a statement that admin's isolation need has been settled.
 *
 * Each subdomain maps to the existing path-based route that already
 * implements it — this only changes which host serves that content, not
 * what it does. Real functionality it depends on (Phase 9 Developer
 * Portal, Phase 14 Aiden) already exists, so this is safe to land now.
 */
const SUBDOMAIN_PREFIX: Record<string, string> = {
  developer: "/developers",
  app: "/developers/apps",
  admin: "/admin",
  aiden: "/aiden",
};

/**
 * Resolves the internal path a request should be served from, given the
 * `Host` header and the requested pathname. Returns `pathname` unchanged
 * (no rewrite) for: bare `koba.games`/`www.koba.games`, localhost/preview
 * hosts, unrecognized subdomains, API routes (subdomains all share one
 * backend — `/api/*` never gets a subdomain prefix), and requests that
 * already target the right internal path directly.
 */
export function resolveSubdomainRewrite(hostname: string, pathname: string): string {
  if (pathname === "/api" || pathname.startsWith("/api/")) return pathname;

  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.koba\.games$/.exec(host);
  if (!match) return pathname;

  const subdomain = match[1] ?? "";
  if (subdomain === "www") return pathname;

  const prefix = SUBDOMAIN_PREFIX[subdomain];
  if (!prefix) return pathname;

  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return pathname;
  return pathname === "/" ? prefix : `${prefix}${pathname}`;
}
