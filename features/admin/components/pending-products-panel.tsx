"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

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
    return <p className="text-sm text-muted">No listings waiting for approval.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {products.map((product) => (
          <li
            key={product.slug}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-foreground">{product.title}</p>
              <p className="text-xs text-muted">
                {product.game} · {product.category} · {product.listingType} · $
                {(product.priceCents / 100).toFixed(2)}
              </p>
              <p className="font-mono text-xs text-muted">
                {product.slug}
                {product.shopSlug ? ` · ${product.shopSlug}` : ""}
                {product.sellerHandle ? ` · @${product.sellerHandle}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
