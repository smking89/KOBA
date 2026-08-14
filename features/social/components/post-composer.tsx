"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PostComposer({ groupSlug }: { groupSlug?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        visibility: "PUBLIC",
        groupSlug,
        tags: [],
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not post.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) {
          void submit();
        }
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Share a drop, tag @handle, a shop, or a group…"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted">
        Mentions respect tag privacy. Blocked accounts can never tag you.
      </p>
      <Button type="submit" disabled={busy || !body.trim()}>
        {busy ? "Posting…" : "Post"}
      </Button>
    </form>
  );
}
