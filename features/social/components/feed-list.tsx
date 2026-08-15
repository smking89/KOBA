"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PostCard, type FeedPost } from "@/features/social/components/post-card";

export function FeedList({
  initial,
  signedIn,
  groupSlug,
}: {
  initial: { items: FeedPost[]; hasMore: boolean; nextCursor: string | null };
  signedIn: boolean;
  groupSlug?: string;
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
        <p className="text-sm text-muted">No posts yet. Follow people or publish the first one.</p>
      ) : (
        items.map((post) => <PostCard key={post.publicRef} post={post} signedIn={signedIn} />)
      )}
      {hasMore ? (
        <Button variant="secondary" onClick={() => void more()} disabled={busy}>
          {busy ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
