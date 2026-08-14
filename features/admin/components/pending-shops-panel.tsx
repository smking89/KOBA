"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

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
    return <p className="text-sm text-muted">No shops waiting for verification.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {shops.map((shop) => (
          <li
            key={shop.slug}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-foreground">{shop.name}</p>
              <p className="text-xs text-muted">
                {shop.productCount} products · {shop.ownerEmail}
                {shop.ownerHandle ? ` · @${shop.ownerHandle}` : ""}
              </p>
              {shop.bio ? <p className="line-clamp-2 text-sm text-muted">{shop.bio}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
