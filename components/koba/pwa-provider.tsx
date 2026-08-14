"use client";

import { SerwistProvider } from "@serwist/next/react";
import type { ReactNode } from "react";

export function PwaProvider({ children }: { children: ReactNode }) {
  // Service worker build is disabled in dev (see next.config.ts), so
  // public/sw.js doesn't exist until `pnpm build`. Registering against it
  // in dev throws a 404. Match that same dev/prod split here so the
  // provider doesn't try to register a file that was never built.
  return (
    <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"}>
      {children}
    </SerwistProvider>
  );
}
