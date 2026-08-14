"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/koba/brand-mark";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/market", label: "Market" },
  { href: "/groups", label: "Groups" },
  { href: "/lfg", label: "LFG" },
  { href: "/feed", label: "Feed" },
  { href: "/messages", label: "Messages" },
] as const;

function isStaffSessionType(value: string | null | undefined): boolean {
  return value === "SUPERADMIN" || value === "ADMIN" || value === "MODERATOR";
}

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const showStaff = isLoggedIn && isStaffSessionType(session?.user.accountType);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <BrandMark />
        <nav aria-label="Desktop" className="hidden items-center gap-5 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
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
              <Button variant="ghost" size="sm" onClick={() => void signOut({ callbackUrl: "/" })}>
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
