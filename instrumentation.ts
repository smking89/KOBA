export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  error: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string; routeType: string },
) {
  const { isSentryEnabled } = await import("./lib/observability/config");
  if (!isSentryEnabled()) return;
  const Sentry = await import("@sentry/nextjs");
  if (typeof Sentry.captureRequestError === "function") {
    Sentry.captureRequestError(error, request, context);
  }
}
