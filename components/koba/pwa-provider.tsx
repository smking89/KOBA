"use client";

import { SerwistProvider } from "@serwist/next/react";
import type { ReactNode } from "react";

export function PwaProvider({ children }: { children: ReactNode }) {
  return <SerwistProvider swUrl="/sw.js">{children}</SerwistProvider>;
}
