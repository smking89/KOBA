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

type PendingShop = {
  slug: string;
  name: string;
  bio: string | null;
  productCount: number;
  ownerHandle: string | null;
  ownerEmail: string;
};

export function PendingShopsPanel({ shops }: { shops: PendingShop[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(slug: string, status: "VERIFIED" | "REJECTED") {
    setError(null);
    const response = await fetch(`/api/admin/shops/${encodeURIComponent(slug)}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not update shop verification.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (shops.length === 0) {
    return <ListPanelEmpty>No shops waiting for verification.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {shops.map((shop) => (
          <ListRow key={shop.slug}>
            <ListRowMain>
              <ListRowTitle>{shop.name}</ListRowTitle>
              <ListRowMeta>
                {shop.productCount} products · {shop.ownerEmail}
                {shop.ownerHandle ? ` · @${shop.ownerHandle}` : ""}
              </ListRowMeta>
              {shop.bio ? <p className="line-clamp-2 text-sm text-muted">{shop.bio}</p> : null}
            </ListRowMain>
            <ListRowActions>
              <Button size="sm" disabled={pending} onClick={() => void act(shop.slug, "VERIFIED")}>
                Verify
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void act(shop.slug, "REJECTED")}
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
