"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Users, Swords, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/market", label: "Market", icon: Store },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/lfg", label: "LFG", icon: Swords },
  { href: "/settings", label: "You", icon: UserRound },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium",
                  active ? "text-neon-lime" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
