"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowTitle,
} from "@/components/dashboard/list-panel";

type PendingDevProduct = {
  publicRef: string;
  slug: string;
  name: string;
  reviewState: string;
  category: string;
  publisher: string | null;
  publisherSlug: string | null;
  versions: {
    publicRef: string;
    semver: string;
    reviewState: string;
    artifacts: {
      filename: string;
      mimeType: string;
      byteSize: number;
      sha256: string;
      status: string;
    }[];
  }[];
};

export function PendingDeveloperProductsPanel({ products }: { products: PendingDevProduct[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(
    publicRef: string,
    action: "approve" | "publish" | "reject" | "request_changes",
  ) {
    setError(null);
    const response = await fetch("/api/admin/developers/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ publicRef, action, reason: `staff ${action}` }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not moderate product.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (products.length === 0) {
    return <ListPanelEmpty>No developer products waiting for review.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {products.map((product) => (
          // Variable-height version list per row — kept stacked at every
          // width rather than ListRow's default sm:flex-row, since a
          // side-by-side actions column would squeeze awkwardly against
          // however many versions this product has.
          <ListRow key={product.publicRef} className="sm:flex-col sm:items-start">
            <ListRowTitle>{product.name}</ListRowTitle>
            <p className="font-mono text-xs text-muted">
              {product.publicRef} · {product.reviewState} · {product.category}
              {product.publisher ? ` · ${product.publisher}` : ""}
            </p>
            {product.versions.map((version) => (
              <p key={version.publicRef} className="text-xs text-muted">
                v{version.semver}{" "}
                {version.artifacts
                  .map((artifact) => `${artifact.filename} ${artifact.sha256.slice(0, 8)}`)
                  .join(", ")}
              </p>
            ))}
            <ListRowActions>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void act(product.publicRef, "approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void act(product.publicRef, "publish")}
              >
                Publish
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => void act(product.publicRef, "request_changes")}
              >
                Request changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void act(product.publicRef, "reject")}
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
