"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { ShareButton } from "@/features/marketplace/components/share-button";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count % 1000 >= 100 ? 1 : 0)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

function RailButton({
  onClick,
  href,
  active,
  label,
  count,
  tone = "feed",
  children,
}: {
  onClick?: () => void;
  href?: string;
  active?: boolean;
  label: string;
  count?: number;
  tone?: "feed" | "card";
  children: React.ReactNode;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex items-center justify-center rounded-full backdrop-blur-sm",
          tone === "card"
            ? cn(
                "h-8 w-8 border border-white/10 bg-black/55",
                active ? "text-destructive" : "text-foreground",
              )
            : cn("h-9 w-9 bg-white/85", active ? "text-destructive" : "text-black/70"),
        )}
      >
        {children}
      </span>
      {count != null ? (
        <span
          className={cn(
            "text-[0.65rem] font-semibold drop-shadow",
            tone === "card" ? "text-foreground" : "text-white",
          )}
        >
          {formatCount(count)}
        </span>
      ) : null}
    </>
  );
  const className = "flex flex-col items-center gap-0.5";
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {content}
    </button>
  );
}

/**
 * TikTok-style vertical action rail (client reference, Fintory UI kit,
 * 2026-08-16): like / comment / repost / share, real counts where the
 * data model actually tracks one — favorites and comments are real
 * counts (ProductFavorite / ProductComment); share has no count (no
 * ShareEvent model exists) so it renders without a number rather than
 * inventing one.
 */
export function ProductActionRail({
  product,
  signedIn,
  variant = "feed",
}: {
  product: PublicProductCard;
  signedIn: boolean;
  variant?: "feed" | "card";
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(product.favorited);
  const [likeCount, setLikeCount] = useState(product.favoriteCount);
  const [busy, setBusy] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);

  async function toggleLike() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${product.slug}`);
      return;
    }
    setBusy(true);
    const response = await fetch("/api/market/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.slug }),
    });
    const payload = (await response.json()) as { favorited?: boolean };
    setBusy(false);
    if (response.ok && typeof payload.favorited === "boolean") {
      setLiked(payload.favorited);
      setLikeCount((count) => count + (payload.favorited ? 1 : -1));
    }
  }

  async function repost() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${product.slug}`);
      return;
    }
    if (reposted || reposting) return;
    setReposting(true);
    const response = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: `Check out ${product.title} on KOBA: /market/${product.slug}`,
      }),
    });
    setReposting(false);
    if (response.ok) {
      setReposted(true);
      router.refresh();
    }
  }

  if (variant === "card") {
    return (
      <RailButton onClick={() => void toggleLike()} active={liked} label="Like" tone="card">
        <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden />
        {busy ? <span className="sr-only">Updating…</span> : null}
      </RailButton>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <RailButton onClick={() => void toggleLike()} active={liked} label="Like" count={likeCount}>
        <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden />
      </RailButton>
      <RailButton
        href={`/market/${product.slug}#comments`}
        label="Comments"
        count={product.commentCount}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
      </RailButton>
      <RailButton
        onClick={() => void repost()}
        active={reposted}
        label={reposted ? "Reposted to your feed" : "Repost to your feed"}
      >
        <Repeat2 className="h-4 w-4" aria-hidden />
      </RailButton>
      <div className="flex flex-col items-center gap-0.5">
        <ShareButton
          slug={product.slug}
          title={product.title}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-black/70 backdrop-blur-sm"
        />
      </div>
      {busy ? <span className="sr-only">Updating…</span> : null}
    </div>
  );
}
