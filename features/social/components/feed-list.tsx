"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/koba/empty-state";
import { PostCard, type FeedPost } from "@/features/social/components/post-card";
import { SponsoredFeedCard } from "@/features/social/components/sponsored-feed-card";
import type { FeedAdDto } from "@/features/social/services/post.service";

type FeedItem = { kind: "post"; post: FeedPost } | { kind: "ad"; ad: FeedAdDto };

export function FeedList({
  initial,
  signedIn,
  groupSlug,
  authorHandle,
  empty = "No posts yet. Follow people or publish the first one.",
}: {
  initial: { items: FeedItem[]; hasMore: boolean; nextCursor: string | null };
  signedIn: boolean;
  groupSlug?: string;
  authorHandle?: string;
  empty?: string;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [busy, setBusy] = useState(false);

  async function more() {
    if (!cursor) {
      return;
    }
    setBusy(true);
    const params = new URLSearchParams({ cursor });
    if (groupSlug) {
      params.set("group", groupSlug);
    }
    if (authorHandle) {
      params.set("handle", authorHandle);
    }
    const response = await fetch(`/api/social/feed?${params.toString()}`);
    const payload = (await response.json()) as typeof initial;
    setBusy(false);
    if (!response.ok) {
      return;
    }
    setItems((current) => [...current, ...payload.items]);
    setCursor(payload.nextCursor);
    setHasMore(payload.hasMore);
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        items.map((entry, index) =>
          entry.kind === "ad" ? (
            <SponsoredFeedCard key={`ad-${entry.ad.campaignId}-${index}`} ad={entry.ad} />
          ) : (
            <PostCard key={entry.post.publicRef} post={entry.post} signedIn={signedIn} />
          ),
        )
      )}
      {hasMore ? (
        <Button variant="secondary" onClick={() => void more()} disabled={busy}>
          {busy ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
