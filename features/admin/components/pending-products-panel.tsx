"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowMain,
  ListRowMeta,
  ListRowTitle,
} from "@/components/dashboard/list-panel";

type PendingProduct = {
  slug: string;
  title: string;
  listingType: string;
  priceCents: number;
  updatedAt: string;
  shopSlug: string | null;
  shopName: string | null;
  game: string;
  category: string;
  sellerHandle: string | null;
};

export function PendingProductsPanel({ products }: { products: PendingProduct[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(slug: string, action: "approve" | "reject") {
    setError(null);
    const path =
      action === "approve"
        ? `/api/admin/products/${encodeURIComponent(slug)}/approve`
        : `/api/admin/products/${encodeURIComponent(slug)}/reject`;
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(action === "reject" ? { body: JSON.stringify({}) } : {}),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? `Could not ${action} listing.`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (products.length === 0) {
    return <ListPanelEmpty>No listings waiting for approval.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {products.map((product) => (
          <ListRow key={product.slug}>
            <ListRowMain>
              <ListRowTitle>{product.title}</ListRowTitle>
              <ListRowMeta>
                {product.game} · {product.category} · <Badge>{product.listingType}</Badge> · $
                {(product.priceCents / 100).toFixed(2)}
              </ListRowMeta>
              <p className="font-mono text-xs text-muted">
                {product.slug}
                {product.shopSlug ? ` · ${product.shopSlug}` : ""}
                {product.sellerHandle ? ` · @${product.sellerHandle}` : ""}
              </p>
            </ListRowMain>
            <ListRowActions>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void act(product.slug, "approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void act(product.slug, "reject")}
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
