"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Home, Store, Newspaper, MessageSquare, Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMoreSectionActive, isNavActive, MOBILE_MORE_LINKS } from "@/features/navigation/lib/nav";

const primary = [
  { href: "/", label: "Home", icon: Home },
  { href: "/market", label: "Market", icon: Store },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/messages", label: "Messages", icon: MessageSquare },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const panelId = useId();
  const moreActive = isMoreSectionActive(pathname);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-background/70 lg:hidden"
          aria-hidden
          onClick={() => setMoreOpen(false)}
        />
      ) : null}
      {moreOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="More destinations"
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-t-xl border border-border bg-surface p-3 shadow-soft lg:hidden"
        >
          <ul className="grid grid-cols-2 gap-1">
            {MOBILE_MORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "block rounded-lg px-3 py-3 text-sm font-medium",
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[0.65rem] font-medium",
                    active ? "text-neon-lime" : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden suppressHydrationWarning />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              className={cn(
                "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[0.65rem] font-medium",
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
