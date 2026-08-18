"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  Key,
  LayoutGrid,
  Package,
  Plug,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/koba/brand-mark";
import { ThemeToggle } from "@/components/koba/theme-toggle";

/**
 * Standalone shell for developer.koba.games (Phase 20, client 2026-08-17:
 * "developer.koba.games...needs its own GUI, UI, UX" — not KOBA's shared
 * AppShell social sidebar). Uses the same global color tokens and
 * dark/light toggle as the rest of the platform (client, 2026-08-17: "the
 * app store, koba.games, admin.koba.games, developer.koba.games all need
 * to follow the same color scheme") — what makes this "its own GUI/UX" is
 * a docs-console sidebar with technical sections (API catalog,
 * applications, keys, webhooks, products), not a community/marketplace
 * nav, not a separate palette.
 */
const NAV = [
  { href: "/developers", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/developers/apis", label: "API catalog", icon: Blocks, exact: false },
  { href: "/developers/applications", label: "Applications", icon: Plug, exact: false },
  { href: "/developers/api-keys", label: "API keys", icon: Key, exact: false },
  { href: "/developers/webhooks", label: "Webhooks", icon: Webhook, exact: false },
  { href: "/developers/products", label: "Products", icon: Package, exact: false },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DevPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <Link href="/developers" className="flex items-center gap-2 px-5 py-4">
          <BrandMark href={null} showWordmark={false} size={24} />
          <span className="text-sm font-bold tracking-tight text-foreground">
            KOBA Developers
          </span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Developer console">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-border px-3 py-3 font-mono text-xs text-muted">
          <Link href="/apps" className="block rounded-md px-3 py-1.5 hover:bg-surface-2/60 hover:text-foreground">
            App Store →
          </Link>
          <Link href="/" className="block rounded-md px-3 py-1.5 hover:bg-surface-2/60 hover:text-foreground">
            koba.games →
          </Link>
          <div className="pt-1">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-surface-2">
        <header className="border-b border-border md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/developers" className="flex items-center gap-2">
              <BrandMark href={null} showWordmark={false} size={22} />
              <span className="text-sm font-bold text-foreground">KOBA Developers</span>
            </Link>
            <ThemeToggle />
          </div>
          <nav
            className="flex gap-1 overflow-x-auto px-3 pb-2"
            aria-label="Developer console"
          >
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                    active ? "bg-surface-2 text-foreground" : "text-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
