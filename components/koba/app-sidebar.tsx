"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Hash, LogOut, Settings } from "lucide-react";
import { BetaBadge } from "@/components/koba/beta-badge";
import { cn } from "@/lib/utils";
import { isNavActive, SIDEBAR_SECTIONS } from "@/features/navigation/lib/nav";
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

export function AppSidebar({
  className,
  onNavigate = () => undefined,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const showStaff = isLoggedIn && isStaffSessionType(session?.user.accountType);

  return (
    <div className={cn("flex h-full min-h-0 w-60 shrink-0 flex-col bg-surface", className)}>
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <p className="truncate text-sm font-semibold tracking-wide">KOBA</p>
        <BetaBadge />
      </div>
      <nav aria-label="Channels" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.links.map((link) => {
                const active = isNavActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm",
                        active
                          ? "bg-white/10 font-medium text-foreground"
                          : "text-muted hover:bg-white/6 hover:text-foreground",
                      )}
                    >
                      <Hash className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {showStaff ? (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm",
              isNavActive(pathname, "/admin")
                ? "bg-white/10 font-medium text-foreground"
                : "text-muted hover:bg-white/6 hover:text-foreground",
            )}
          >
            <Hash className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            Staff
          </Link>
        ) : null}
      </nav>
      <div className="flex h-[52px] items-center gap-2 bg-black/25 px-2">
        {isLoggedIn ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-background">
                {(session?.user.kobaId ?? "K").slice(0, 1)}
              </span>
              <span className="truncate font-mono text-xs text-muted">
                {session?.user.kobaId ?? "Signed in"}
              </span>
            </div>
            <Link
              href="/settings"
              onClick={onNavigate}
              aria-label="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-white/8 hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              type="button"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-white/8 hover:text-foreground"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            onClick={onNavigate}
            className="flex h-8 w-full items-center justify-center rounded-md bg-white/8 text-sm font-semibold hover:bg-white/12"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
