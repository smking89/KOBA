"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { ShareButton } from "@/features/marketplace/components/share-button";
import type { PublicProductCard } from "@/features/marketplace/lib/product-dto";
import { cn } from "@/lib/utils";

function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count % 1000 >= 100 ? 1 : 0)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

// Flat icon treatment throughout (client correction, 2026-08-16: "it
// should not have a circle border around them") — matches the plain
// lucide-icon convention already used platform-wide (IconRail/AppSidebar).
// The "overlay" layout (full-bleed feed slide, icon sits on a photo/video)
// gets a drop-shadow for legibility; "inline" (compact grid card) sits on
// the card's own surface color; "card" (TCG-style card, client reference
// 2026-08-17) is a pure brand-orange outline rail over a flat white image
// area — no shadow needed, nothing to stand out against.
function RailButton({
  onClick,
  href,
  active,
  label,
  count,
  layout,
  children,
}: {
  onClick?: () => void;
  href?: string;
  active?: boolean;
  label: string;
  count?: number;
  layout: "overlay" | "inline" | "card";
  children: React.ReactNode;
}) {
  const overlay = layout === "overlay";
  const card = layout === "card";
  const content = (
    <>
      <span
        className={cn(
          "flex items-center justify-center transition-transform hover:scale-110",
          overlay && "h-8 w-8 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
          layout === "inline" && "h-5 w-5 text-muted",
          card && "h-8 w-8 text-neon-lime",
          active && "text-neon-lime",
        )}
      >
        {children}
      </span>
      {/* "card" layout (TCG-style product card, client exact-match
          reference 2026-08-17) shows icons only, no count labels. */}
      {count != null && !card ? (
        <span
          className={cn(
            "font-semibold",
            overlay && "text-[0.65rem] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
            layout === "inline" && "text-[0.7rem] text-muted",
          )}
        >
          {formatCount(count)}
        </span>
      ) : null}
    </>
  );
  const className =
    layout === "inline" ? "flex items-center gap-1" : "flex flex-col items-center gap-0.5";
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
 * Like / share / comment / repost / save — real counts where the data
 * model actually tracks one (ProductFavorite / ProductComment); save is a
 * private wishlist (ProductSave) so it never shows a count; share has no
 * count (no ShareEvent model exists) so it renders without a number
 * rather than inventing one.
 *
 * `layout="overlay"` is the TikTok-style vertical rail over a full-bleed
 * feed slide. `layout="inline"` is a compact horizontal row for the
 * marketplace grid card. `layout="card"` is the brand-orange outline rail
 * for the TCG-style product card (client reference, 2026-08-17) — same
 * vertical rail shape as "overlay" but a flat orange-outline treatment
 * and the reference's own icon order (like, share, comment, repost, save).
 */
export function ProductActionRail({
  product,
  signedIn,
  layout = "overlay",
}: {
  product: PublicProductCard;
  signedIn: boolean;
  layout?: "overlay" | "inline" | "card";
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(product.favorited);
  const [likeCount, setLikeCount] = useState(product.favoriteCount);
  const [saved, setSaved] = useState(product.saved);
  const [saving, setSaving] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);

  async function toggleLike() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${product.slug}`);
      return;
    }
    const response = await fetch("/api/market/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.slug }),
    });
    const payload = (await response.json()) as { favorited?: boolean };
    if (response.ok && typeof payload.favorited === "boolean") {
      setLiked(payload.favorited);
      setLikeCount((count) => count + (payload.favorited ? 1 : -1));
    }
  }

  async function toggleSave() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${product.slug}`);
      return;
    }
    if (saving) return;
    setSaving(true);
    const response = await fetch("/api/market/saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.slug }),
    });
    const payload = (await response.json()) as { saved?: boolean };
    setSaving(false);
    if (response.ok && typeof payload.saved === "boolean") {
      setSaved(payload.saved);
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

  const iconSize = layout === "inline" ? "h-[18px] w-[18px]" : "h-6 w-6";
  const shareClassName = cn(
    "flex items-center justify-center",
    layout === "overlay" && "h-8 w-8 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
    layout === "inline" && "h-5 w-5 text-muted hover:text-neon-lime",
    layout === "card" && "h-8 w-8 text-neon-lime",
  );

  const likeButton = (
    <RailButton onClick={() => void toggleLike()} active={liked} label="Like" count={likeCount} layout={layout}>
      <Heart className={cn(iconSize, liked && "fill-current")} aria-hidden />
    </RailButton>
  );
  const shareButton = (
    <ShareButton
      slug={product.slug}
      title={product.title}
      icon={layout === "card" ? "forward" : "share"}
      className={shareClassName}
    />
  );
  const commentButton = (
    <RailButton href={`/market/${product.slug}#comments`} label="Comments" count={product.commentCount} layout={layout}>
      <MessageCircle className={iconSize} aria-hidden />
    </RailButton>
  );
  const repostButton = (
    <RailButton
      onClick={() => void repost()}
      active={reposted}
      label={reposted ? "Reposted to your feed" : "Repost to your feed"}
      layout={layout}
    >
      <Repeat2 className={iconSize} aria-hidden />
    </RailButton>
  );
  const saveButton = (
    <RailButton onClick={() => void toggleSave()} active={saved} label={saved ? "Saved" : "Save"} layout={layout}>
      <Bookmark className={cn(iconSize, saved && "fill-current")} aria-hidden />
    </RailButton>
  );

  return (
    <div className={layout === "inline" ? "flex items-center gap-3.5" : "flex flex-col items-center gap-4"}>
      {layout === "card" ? (
        <>
          {likeButton}
          {shareButton}
          {commentButton}
          {repostButton}
          {saveButton}
        </>
      ) : (
        <>
          {likeButton}
          {commentButton}
          {saveButton}
          {repostButton}
          {shareButton}
        </>
      )}
    </div>
  );
}
