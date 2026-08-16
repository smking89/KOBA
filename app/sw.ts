import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";
import {
  isSensitiveDocumentPath,
  isSensitivePath,
  LEGACY_PAGE_CACHES,
  PAGES_CACHE_NAME,
} from "@/lib/pwa/sensitive-routes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline";

const offlineFallbackPlugin = {
  handlerDidError: async () => (await caches.match(OFFLINE_URL)) ?? Response.error(),
};

const navigationHandler = new NetworkFirst({
  cacheName: PAGES_CACHE_NAME,
  networkTimeoutSeconds: 5,
  plugins: [offlineFallbackPlugin],
});

// KOBA-PWA-001: authenticated documents are never written to Cache Storage.
// They still get the offline page when the network is unavailable.
const sensitiveNavigationHandler = new NetworkOnly({
  plugins: [offlineFallbackPlugin],
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => isSensitivePath(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" && isSensitiveDocumentPath(url.pathname),
      handler: sensitiveNavigationHandler,
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: navigationHandler,
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Remove page caches written by earlier service-worker versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all(LEGACY_PAGE_CACHES.map((name) => caches.delete(name))));
});

self.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") return;
  if (event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
  // KOBA-PWA-002: logout asks the worker to drop cached documents.
  if (event.data.type === "CLEAR_PAGE_CACHES") {
    event.waitUntil?.(
      Promise.all([PAGES_CACHE_NAME, ...LEGACY_PAGE_CACHES].map((name) => caches.delete(name))),
    );
  }
});
