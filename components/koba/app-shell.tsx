"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/koba/app-header";
import { AppSidebar } from "@/components/koba/app-sidebar";
import { IconRail } from "@/components/koba/icon-rail";
import { MobileNav } from "@/components/koba/mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 rounded-md bg-brand-gradient px-3 py-2 text-sm font-semibold text-background"
      >
        Skip to content
      </a>
      <IconRail />
      <AppSidebar className="hidden md:flex" />

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <AppSidebar
            className="relative z-10 flex shadow-soft"
            onNavigate={() => setMenuOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-surface-2">
        <AppHeader onOpenMenu={() => setMenuOpen(true)} />
        <main
          id="main-content"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6"
        >
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
