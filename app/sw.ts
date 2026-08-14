import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";
import { isSensitivePath } from "@/lib/pwa/sensitive-routes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline";

const navigationHandler = new NetworkFirst({
  cacheName: "koba-pages",
  networkTimeoutSeconds: 5,
  plugins: [
    {
      handlerDidError: async () => (await caches.match(OFFLINE_URL)) ?? Response.error(),
    },
  ],
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
      matcher: ({ request }) => request.mode === "navigate",
      handler: navigationHandler,
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener("message", (event) => {
  if (event.data && typeof event.data === "object" && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
