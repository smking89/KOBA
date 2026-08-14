"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type StoryItem = {
  publicRef: string;
  body: string;
  seen: boolean;
  isSelf: boolean;
  author: { handle: string; name: string };
};

export function StoryTray({ stories, signedIn }: { stories: StoryItem[]; signedIn: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addStory() {
    if (!signedIn) {
      router.push("/login?callbackUrl=/feed");
      return;
    }
    const response = await fetch("/api/social/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not post story.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {signedIn ? (
          <form
            className="flex min-w-40 flex-col gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (body.trim()) {
                void addStory();
              }
            }}
          >
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={280}
              placeholder="Your story"
              className="h-10 rounded-full border border-neon-lime/40 bg-surface px-3 text-xs"
            />
            <Button size="sm" type="submit">
              Add
            </Button>
          </form>
        ) : null}
        {stories.map((story) => (
          <Link
            key={story.publicRef}
            href={`/stories/${story.publicRef}`}
            className="flex min-w-16 flex-col items-center gap-1"
          >
            <span
              className={
                story.seen
                  ? "flex h-12 w-12 items-center justify-center rounded-full border border-border text-xs"
                  : "flex h-12 w-12 items-center justify-center rounded-full border-2 border-neon-lime text-xs"
              }
            >
              {story.author.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="max-w-16 truncate text-[0.65rem] text-muted">
              {story.isSelf ? "You" : story.author.handle}
            </span>
          </Link>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
