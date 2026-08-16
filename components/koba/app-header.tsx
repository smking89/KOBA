"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/koba/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DESKTOP_MORE_LINKS,
  DESKTOP_PRIMARY_LINKS,
  isNavActive,
} from "@/features/navigation/lib/nav";
import { clearPageCaches } from "@/lib/pwa/clear-caches";

async function handleSignOut(): Promise<void> {
  await clearPageCaches();
  try {
    await fetch("/api/staff-mfa/sessions", { method: "DELETE", cache: "no-store" });
  } catch {
    // Elevation cookie clearing must never block sign-out.
  }
  await signOut({ callbackUrl: "/" });
}

function isStaffSessionType(value: string | null | undefined): boolean {
  return value === "SUPERADMIN" || value === "ADMIN" || value === "MODERATOR";
}

const navItemClass =
  "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors";

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const showStaff = isLoggedIn && isStaffSessionType(session?.user.accountType);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <BrandMark />
        <nav aria-label="Desktop" className="hidden min-w-0 items-center gap-1 lg:flex">
          {DESKTOP_PRIMARY_LINKS.map((link) => {
            const active = isNavActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  navItemClass,
                  active
                    ? "bg-surface-2 text-neon-lime"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={cn(
                navItemClass,
                moreOpen
                  ? "bg-surface-2 text-neon-lime"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
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
                className="absolute top-full right-0 z-50 mt-2 min-w-48 rounded-xl border border-border bg-surface p-1.5 shadow-soft"
              >
                {DESKTOP_MORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    role="menuitem"
                    href={link.href}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm",
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
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isLoggedIn ? (
            <>
              {showStaff ? (
                <Link
                  href="/admin"
                  className={cn(
                    navItemClass,
                    "hidden text-muted hover:bg-surface-2 hover:text-foreground sm:inline-flex",
                    isNavActive(pathname, "/admin") && "bg-surface-2 text-neon-lime",
                  )}
                >
                  Staff
                </Link>
              ) : null}
              <Link
                href="/orders"
                className={cn(
                  navItemClass,
                  "hidden text-muted hover:bg-surface-2 hover:text-foreground sm:inline-flex",
                  isNavActive(pathname, "/orders") && "bg-surface-2 text-neon-lime",
                )}
              >
                Orders
              </Link>
              <Link
                href="/settings"
                className={cn(
                  navItemClass,
                  "max-w-[7.5rem] truncate font-mono text-xs text-muted hover:bg-surface-2 hover:text-foreground sm:max-w-[12rem]",
                  isNavActive(pathname, "/settings") && "bg-surface-2 text-neon-lime",
                )}
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
                className={cn(navItemClass, "text-muted hover:bg-surface-2 hover:text-foreground")}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
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
