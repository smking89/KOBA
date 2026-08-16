"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type PendingAidenAsset = {
  publicRef: string;
  title: string;
  game: string;
  assetType: string;
  technicalStatus: string;
  provider: string | null;
  model: string | null;
  ownerHandle: string | null;
};

export function PendingAidenPanel({ assets }: { assets: PendingAidenAsset[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(publicRef: string, action: "approve" | "reject") {
    setError(null);
    const response = await fetch(`/api/admin/aiden/${encodeURIComponent(publicRef)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? `Could not ${action} Aiden asset.`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (assets.length === 0) {
    return <p className="text-sm text-muted">No Aiden assets waiting for review.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {assets.map((asset) => (
          <li
            key={asset.publicRef}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-foreground">{asset.title}</p>
              <p className="text-xs text-muted">
                {asset.game} · {asset.assetType} · {asset.technicalStatus}
              </p>
              <p className="font-mono text-xs text-muted">
                {asset.publicRef}
                {asset.provider ? ` · ${asset.provider}` : ""}
                {asset.model ? `/${asset.model}` : ""}
                {asset.ownerHandle ? ` · @${asset.ownerHandle}` : ""}
              </p>
              <p className="text-xs text-muted">
                Approval does not create a marketplace listing or mark output as game-ready.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void act(asset.publicRef, "approve")}
              >
                Approve review
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void act(asset.publicRef, "reject")}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
