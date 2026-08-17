"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { HexAvatar } from "@/components/koba/hex-avatar";
import { cn } from "@/lib/utils";

const SLOT = {
  xs: "h-8 w-8",
  sm: "h-12 w-12",
  md: "h-16 w-16",
} as const;

function profileHref(handle: string | null | undefined): string {
  if (!handle) return "/enter";
  return `/u/${encodeURIComponent(handle)}`;
}

export function NavProfileAvatar({
  size = "sm",
  className,
  onNavigate,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;

  if (!user) {
    if (status === "unauthenticated") return null;
    return <div className={cn("shrink-0", SLOT[size], className)} aria-hidden />;
  }

  const handle = user.handle;
  const href = profileHref(handle);
  const onProfile = Boolean(
    handle && (pathname === `/u/${handle}` || pathname.startsWith(`/u/${handle}/`)),
  );
  const label = handle ? `@${handle}` : "Your profile";

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={onProfile ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center justify-center rounded-xl p-0.5 transition-colors",
        onProfile ? "bg-white/10" : "hover:bg-white/8",
        className,
      )}
    >
      <HexAvatar
        name={user.name ?? user.kobaId ?? "K"}
        image={user.image ?? null}
        size={size}
        plus={Boolean(user.plusBadge)}
        accountType={user.accountType ?? undefined}
      />
    </Link>
  );
}
