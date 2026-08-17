"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Hash, Menu } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isNavActive, navLabelForPath } from "@/features/navigation/lib/nav";

export function AppHeader({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = Boolean(session?.user) || status === "authenticated";
  const title = navLabelForPath(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3 shadow-[0_1px_0_rgba(0,0,0,0.35)]">
      {onOpenMenu ? (
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-white/8 hover:text-foreground md:hidden"
          aria-label="Open navigation"
          onClick={onOpenMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Hash className="hidden h-5 w-5 text-muted sm:block" aria-hidden />
        <p className="truncate text-base font-semibold">{title}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isLoggedIn ? (
          <Link
            href="/orders"
            className={cn(
              "hidden h-8 items-center rounded-md px-2 text-sm text-muted hover:bg-white/8 hover:text-foreground sm:inline-flex",
              isNavActive(pathname, "/orders") && "bg-white/10 text-foreground",
            )}
          >
            Orders
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-md px-2 text-sm text-muted hover:bg-white/8 hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
