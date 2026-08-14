import type { ReactNode } from "react";
import { AppHeader } from "@/components/koba/app-header";
import { MobileNav } from "@/components/koba/mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-8">{children}</main>
      <MobileNav />
    </div>
  );
}
