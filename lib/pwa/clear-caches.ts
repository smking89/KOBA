"use client";

import { LEGACY_PAGE_CACHES, PAGES_CACHE_NAME } from "@/lib/pwa/sensitive-routes";

/**
 * Best-effort removal of service-worker page caches on logout
 * (KOBA-PWA-002). Runs in the window, so it works even when no service
 * worker is currently controlling the page.
 */
export async function clearPageCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    await Promise.all([PAGES_CACHE_NAME, ...LEGACY_PAGE_CACHES].map((name) => caches.delete(name)));
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PAGE_CACHES" });
  } catch {
    // Cache clearing must never block sign-out.
  }
}
