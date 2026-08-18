"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedAdDto } from "@/features/social/services/post.service";

/**
 * Client, 2026-08-18 (KOBA Ads / Phase 7): "native rendering must be
 * visually/structurally identical to organic content." Same card
 * shell PostCard uses (rounded border, padding, author-row position
 * swapped for a "Sponsored" badge) so it reads as one more feed item,
 * not a banner — while still using SponsoredPlacementCard's click
 * logging so budget/impression tracking is identical to every other
 * placement this campaign might also run in.
 */
export function SponsoredFeedCard({ ad }: { ad: FeedAdDto }) {
  function logClick() {
    void fetch("/api/ads/click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId: ad.campaignId }),
    });
  }

  return (
    <article className="space-y-3 rounded-xl border border-neon-lime/20 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="live" dot>
          Sponsored
        </Badge>
      </div>
      <div>
        <Link href={ad.href} onClick={logClick} className="text-lg font-semibold hover:text-neon-lime">
          {ad.title}
        </Link>
        <p className="text-sm text-muted">{ad.subtitle}</p>
      </div>
      <Link
        href={ad.href}
        onClick={logClick}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
      >
        {ad.actionLabel}
      </Link>
    </article>
  );
}
