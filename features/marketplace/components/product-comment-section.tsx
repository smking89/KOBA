"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PublicProductComment } from "@/features/marketplace/lib/product-dto";

export function ProductCommentSection({
  slug,
  initial,
  signedIn,
}: {
  slug: string;
  initial: PublicProductComment[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${slug}`);
      return;
    }
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/market/products/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const payload = (await response.json()) as { publicRef?: string; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not post comment.");
      return;
    }
    setComments((prev) => [
      ...prev,
      {
        publicRef: payload.publicRef ?? "",
        body,
        createdAt: new Date().toISOString(),
        author: { name: "You", handle: null, kobaId: null },
      },
    ]);
    setBody("");
  }

  return (
    <div id="comments" className="space-y-4 scroll-mt-20">
      <h2 className="text-lg font-semibold">Comments ({comments.length})</h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet — be the first.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.publicRef} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-semibold">
                {comment.author.handle ? `@${comment.author.handle}` : comment.author.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={signedIn ? "Add a comment…" : "Sign in to comment"}
          rows={3}
          maxLength={1000}
          disabled={!signedIn}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button size="sm" onClick={() => void submit()} disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </div>
  );
}
