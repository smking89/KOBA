"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Home, Store, Newspaper, MessageSquare, Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isMoreSectionActive,
  isNavActive,
  MOBILE_MORE_LINKS,
  MOBILE_PRIMARY_HREFS,
} from "@/features/navigation/lib/nav";

const PRIMARY_META: Record<(typeof MOBILE_PRIMARY_HREFS)[number], { label: string; icon: LucideIcon }> = {
  "/": { label: "Home", icon: Home },
  "/market": { label: "Market", icon: Store },
  "/feed": { label: "Feed", icon: Newspaper },
  "/messages": { label: "Messages", icon: MessageSquare },
};

const primary = MOBILE_PRIMARY_HREFS.map((href) => ({ href, ...PRIMARY_META[href] }));

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const panelId = useId();
  const moreActive = isMoreSectionActive(pathname);

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-background/70 md:hidden"
          aria-hidden
          onClick={() => setMoreOpen(false)}
        />
      ) : null}
      {moreOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="More destinations"
          className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-lg rounded-t-lg border border-border bg-surface p-3 shadow-soft md:hidden"
        >
          <ul className="grid grid-cols-2 gap-1">
            {MOBILE_MORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "block rounded-md px-3 py-3 text-sm font-medium",
                    isNavActive(pathname, link.href)
                      ? "bg-surface-2 text-neon-lime"
                      : "text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                  onClick={() => setMoreOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
          <li>
            <button
              type="button"
              className={cn(
                "flex min-w-14 flex-col items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium",
                moreOpen || moreActive ? "text-neon-lime" : "text-muted hover:text-foreground",
              )}
              aria-expanded={moreOpen}
              aria-controls={panelId}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <Ellipsis className="h-5 w-5" aria-hidden suppressHydrationWarning />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
