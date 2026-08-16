"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import {
  aidenAssetTypeLabel,
  aidenTechnicalLabel,
  type AidenAssetView,
} from "@/features/aiden/lib/types";

export function AidenLibraryCard({ asset }: { asset: AidenAssetView }) {
  const [current, setCurrent] = useState(asset);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitReview() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/aiden/library/${current.publicRef}/publish`, {
        method: "POST",
        headers: { "Cache-Control": "no-store" },
      });
      const payload = (await response.json()) as AidenAssetView & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not submit for review.");
        return;
      }
      setCurrent(payload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="h-full">
      <CardTitle>{current.title}</CardTitle>
      <CardDescription>
        {current.game} · {aidenAssetTypeLabel(current.assetType)} · {current.previewLabel}
      </CardDescription>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/aiden/library/${current.publicRef}/media`}
        alt={`${current.title} concept preview`}
        className="mt-3 h-40 w-full rounded-md border border-border object-cover bg-surface-2"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="accent">{aidenTechnicalLabel(current.technicalStatus)}</StatusPill>
        <StatusPill>{current.moderation}</StatusPill>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={
            busy ||
            current.moderation === "PENDING_REVIEW" ||
            current.technicalStatus === "VALIDATION_FAILED"
          }
          onClick={() => void submitReview()}
        >
          Submit for marketplace review
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Review does not publish a listing. Concept output is never treated as game-ready.
      </p>
    </Card>
  );
}
