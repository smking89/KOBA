"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/koba/empty-state";
import { PostCard, type FeedPost } from "@/features/social/components/post-card";

export function FeedList({
  initial,
  signedIn,
  groupSlug,
  authorHandle,
  empty = "No posts yet. Follow people or publish the first one.",
}: {
  initial: { items: FeedPost[]; hasMore: boolean; page: number };
  signedIn: boolean;
  groupSlug?: string;
  authorHandle?: string;
  empty?: string;
}) {
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [busy, setBusy] = useState(false);

  async function more() {
    setBusy(true);
    const params = new URLSearchParams({ page: String(page + 1) });
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
    setPage(payload.page);
    setHasMore(payload.hasMore);
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
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
