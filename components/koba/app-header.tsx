"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/koba/brand-mark";
import { Button } from "@/components/ui/button";
import {
  DESKTOP_MORE_LINKS,
  DESKTOP_PRIMARY_LINKS,
  isNavActive,
} from "@/features/navigation/lib/nav";
import { clearPageCaches } from "@/lib/pwa/clear-caches";

async function handleSignOut(): Promise<void> {
  // KOBA-PWA-002: drop cached documents before the session ends so the next
  // user of this device cannot replay authenticated pages from Cache Storage.
  await clearPageCaches();
  await signOut({ callbackUrl: "/" });
}

function isStaffSessionType(value: string | null | undefined): boolean {
  return value === "SUPERADMIN" || value === "ADMIN" || value === "MODERATOR";
}

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const showStaff = isLoggedIn && isStaffSessionType(session?.user.accountType);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <BrandMark />
        <nav aria-label="Desktop" className="hidden items-center gap-4 lg:flex">
          {DESKTOP_PRIMARY_LINKS.map((link) => {
            const active = isNavActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  active ? "text-neon-lime" : "text-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <span className="border-b-2 border-neon-lime pb-0.5">{link.label}</span>
                ) : (
                  link.label
                )}
              </Link>
            );
          })}
          <div className="relative">
            <button
              type="button"
              className={cn(
                "text-sm font-medium transition-colors",
                moreOpen ? "text-neon-lime" : "text-muted hover:text-foreground",
              )}
              aria-expanded={moreOpen}
              aria-controls={moreId}
              onClick={() => setMoreOpen((open) => !open)}
            >
              More
            </button>
            {moreOpen ? (
              <div
                id={moreId}
                role="menu"
                className="absolute top-full right-0 z-50 mt-2 min-w-44 rounded-md border border-border bg-surface p-1 shadow-soft"
              >
                {DESKTOP_MORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    role="menuitem"
                    href={link.href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm",
                      isNavActive(pathname, link.href)
                        ? "bg-surface-2 text-neon-lime"
                        : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                    onClick={() => setMoreOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <>
              {showStaff ? (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  Staff
                </Link>
              ) : null}
              <Link
                href="/orders"
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Orders
              </Link>
              <Link
                href="/settings"
                className="hidden font-mono text-xs text-muted transition-colors hover:text-foreground sm:inline"
              >
                {session?.user.kobaId ?? "Settings"}
              </Link>
              <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
