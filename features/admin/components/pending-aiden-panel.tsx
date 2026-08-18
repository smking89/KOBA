"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowMain,
  ListRowMeta,
  ListRowTitle,
} from "@/components/dashboard/list-panel";

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
    return <ListPanelEmpty>No Aiden assets waiting for review.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {assets.map((asset) => (
          <ListRow key={asset.publicRef}>
            <ListRowMain>
              <ListRowTitle>{asset.title}</ListRowTitle>
              <ListRowMeta>
                {asset.game} · {asset.assetType} · {asset.technicalStatus}
              </ListRowMeta>
              <p className="font-mono text-xs text-muted">
                {asset.publicRef}
                {asset.provider ? ` · ${asset.provider}` : ""}
                {asset.model ? `/${asset.model}` : ""}
                {asset.ownerHandle ? ` · @${asset.ownerHandle}` : ""}
              </p>
              <ListRowMeta>
                Approval does not create a marketplace listing or mark output as game-ready.
              </ListRowMeta>
            </ListRowMain>
            <ListRowActions>
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
            </ListRowActions>
          </ListRow>
        ))}
      </ListPanel>
    </div>
  );
}
