"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/koba/brand-mark";

const links = [
  { href: "/", label: "Home" },
  { href: "/market", label: "Market" },
  { href: "/groups", label: "Groups" },
  { href: "/lfg", label: "LFG" },
  { href: "/feed", label: "Feed" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

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
        <div className="hidden text-xs text-muted md:block">Phase 1 · Foundation</div>
      </div>
    </header>
  );
}
