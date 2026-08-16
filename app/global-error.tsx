"use client";

import { useEffect } from "react";
import { isBrowserSentryEnabled } from "@/lib/observability/sentry-public";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isBrowserSentryEnabled()) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Try again, or return home.</p>
        {error.digest ? <p>Reference: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}
