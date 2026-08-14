"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type FeedPost = {
  publicRef: string;
  body: string;
  sponsored: boolean;
  createdAt: string;
  author: { handle: string; name: string; kobaId: string | null };
  group: { slug: string; name: string } | null;
  media: { url: string; kind: string }[];
  tags: { type: string; slug: string }[];
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  comments: { publicRef: string; body: string; author: { handle: string; name: string } }[];
};

export function PostCard({ post, signedIn }: { post: FeedPost; signedIn: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(path: string) {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/feed`);
      return;
    }
    const response = await fetch(`/api/social/posts/${post.publicRef}/${path}`, { method: "POST" });
    const payload = (await response.json()) as { liked?: boolean; saved?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not update.");
      return;
    }
    if (typeof payload.liked === "boolean") {
      setLiked(payload.liked);
      setLikeCount((count) => count + (payload.liked ? 1 : -1));
    }
    if (typeof payload.saved === "boolean") {
      setSaved(payload.saved);
    }
  }

  async function submitComment() {
    if (!signedIn) {
      router.push("/login?callbackUrl=/feed");
      return;
    }
    const response = await fetch(`/api/social/posts/${post.publicRef}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Could not comment.");
      return;
    }
    setComment("");
    router.refresh();
  }

  async function report() {
    if (!signedIn) {
      router.push("/login?callbackUrl=/feed");
      return;
    }
    await fetch("/api/social/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "POST",
        targetRef: post.publicRef,
        reason: "Reported from the feed for review.",
      }),
    });
    setError("Report filed for staff review.");
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      {post.sponsored ? (
        <p className="mb-2 text-[0.65rem] font-bold tracking-wide text-muted uppercase">
          Sponsored · Shop
        </p>
      ) : null}
      <header className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/u/${post.author.handle}`} className="font-semibold hover:text-neon-lime">
            {post.author.name}
          </Link>
          {post.author.kobaId ? (
            <span className="ml-2 font-mono text-xs text-muted">{post.author.kobaId}</span>
          ) : null}
          {post.group ? (
            <Link href={`/groups/${post.group.slug}`} className="ml-2 text-xs text-neon-lime">
              {post.group.name}
            </Link>
          ) : null}
        </div>
        <button
          type="button"
          className="text-xs text-muted hover:text-foreground"
          onClick={() => void report()}
        >
          Report
        </button>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>
      {post.tags.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          {post.tags.map((tag) => (
            <span key={`${tag.type}-${tag.slug}`} className="mr-2">
              {tag.type === "USER" ? `@${tag.slug}` : `${tag.type.toLowerCase()}:${tag.slug}`}
            </span>
          ))}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={liked ? "secondary" : "ghost"} onClick={() => void act("like")}>
          Like · {likeCount}
        </Button>
        <Button size="sm" variant={saved ? "secondary" : "ghost"} onClick={() => void act("save")}>
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      {post.comments.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {post.comments.map((row) => (
            <li key={row.publicRef}>
              <Link href={`/u/${row.author.handle}`} className="font-medium hover:text-neon-lime">
                {row.author.name}
              </Link>{" "}
              {row.body}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (comment.trim()) {
            void submitComment();
          }
        }}
      >
        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Write a comment…"
          className="h-9 flex-1 rounded-md border border-border bg-surface-2 px-3 text-sm"
        />
        <Button size="sm" type="submit">
          Reply
        </Button>
      </form>
    </article>
  );
}
