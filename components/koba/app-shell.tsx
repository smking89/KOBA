import type { ReactNode } from "react";
import { AppHeader } from "@/components/koba/app-header";
import { MobileNav } from "@/components/koba/mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-semibold text-background"
      >
        Skip to content
      </a>
      <AppHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"
      >
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
