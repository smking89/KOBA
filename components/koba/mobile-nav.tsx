"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Newspaper, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive, MOBILE_PRIMARY_HREFS } from "@/features/navigation/lib/nav";

const PRIMARY_META: Record<(typeof MOBILE_PRIMARY_HREFS)[number], { label: string; icon: LucideIcon }> = {
  "/": { label: "Home", icon: Home },
  "/market": { label: "Market", icon: Store },
  "/feed": { label: "Feed", icon: Newspaper },
  "/messages": { label: "Messages", icon: MessageSquare },
};

const primary = MOBILE_PRIMARY_HREFS.map((href) => ({ href, ...PRIMARY_META[href] }));

/**
 * Primary-only bottom tab bar. The full nav (primary + more) already has a
 * single entry point at every width below `lg` — the hamburger menu in
 * AppHeader — so this doesn't duplicate that with its own "More" trigger.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium",
                  active ? "text-neon-lime" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden suppressHydrationWarning />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
