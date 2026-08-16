"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Store,
  Server,
  Users,
  Newspaper,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/koba/brand-mark";
import { cn } from "@/lib/utils";
import { isNavActive, RAIL_LINKS } from "@/features/navigation/lib/nav";

const icons: Record<string, LucideIcon> = {
  "/": Home,
  "/market": Store,
  "/servers": Server,
  "/groups": Users,
  "/feed": Newspaper,
  "/messages": MessageSquare,
};

export function IconRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hosts"
      className="hidden h-dvh w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-background py-3 md:flex"
    >
      <BrandMark href="/" showWordmark={false} />
      <div className="h-px w-8 bg-white/10" aria-hidden />
      {RAIL_LINKS.map((link) => {
        const Icon = icons[link.href] ?? Home;
        const active = isNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            title={link.label}
            aria-label={link.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-12 w-12 items-center justify-center text-muted transition-[border-radius,background-color,color] duration-150",
              active
                ? "rounded-2xl bg-brand-gradient text-background"
                : "rounded-[24px] bg-surface-3 hover:rounded-2xl hover:bg-neon-lime/20 hover:text-neon-lime",
            )}
          >
            <span
              className={cn(
                "absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r bg-foreground transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
            <Icon className="h-5 w-5" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
