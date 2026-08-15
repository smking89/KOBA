import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
  disable: process.env.NODE_ENV === "development",
});

const isDev = process.env.NODE_ENV === "development";

/**
 * KOBA-SEC-006: environment-aware security headers.
 *
 * The CSP keeps `unsafe-inline` for scripts/styles because Next.js App Router
 * injects inline bootstrap scripts and Tailwind emits inline styles; a
 * nonce-based CSP is deferred (documented in the production-readiness audit).
 * `unsafe-eval` and websockets are development-only (React Refresh / HMR).
 * img/media allow any https origin because user media URLs are https-validated
 * against MEDIA_ALLOWED_HOSTS at write time.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""} https://*.ingest.sentry.io https://*.sentry.io`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
]
  .join("; ")
  .concat(isDev ? "" : "; upgrade-insecure-requests");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }];
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      { source: "/login/mfa", headers: noStore },
      { source: "/admin", headers: noStore },
      { source: "/admin/:path*", headers: noStore },
      { source: "/settings/security", headers: noStore },
      { source: "/settings/security/:path*", headers: noStore },
      { source: "/api/staff-mfa/:path*", headers: noStore },
      { source: "/api/health", headers: noStore },
      { source: "/api/ready", headers: noStore },
    ];
  },
};

const serwistConfig = withSerwist(nextConfig);

export default withSentryConfig(serwistConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: false,
  disableLogger: true,
  automaticVercelMonitors: false,
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
});
