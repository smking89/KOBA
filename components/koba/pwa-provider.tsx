"use client";

import { SerwistProvider } from "@serwist/next/react";
import { type ReactNode, useEffect } from "react";

const isDev = process.env.NODE_ENV === "development";

export function PwaProvider({ children }: { children: ReactNode }) {
  // Service worker build is disabled in dev (see next.config.ts), so
  // public/sw.js doesn't exist until `pnpm build`. Registering against it
  // in dev throws a 404. Match that same dev/prod split here so the
  // provider doesn't try to register a file that was never built.
  //
  // Also self-heal: if a service worker was already registered for this
  // origin before this fix landed (or from an earlier `pnpm build && start`
  // on the same port), the browser keeps retrying it on every load
  // regardless of what we do now. Clear those out in dev so a stale
  // registration can't keep throwing this error after a normal refresh.
  useEffect(() => {
    if (!isDev || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) void registration.unregister();
    });
  }, []);

  return (
    <SerwistProvider swUrl="/sw.js" disable={isDev}>
      {children}
    </SerwistProvider>
  );
}
