"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { cn } from "@/lib/utils";
import { aidenAssetTypeLabel, aidenTechnicalLabel, type AidenAssetView } from "@/features/aiden/lib/types";
import { PublishAssetForm } from "@/features/aiden/components/publish-asset-form";

type CatalogOption = { slug: string; name: string };

export function LibraryAssetCard({
  asset,
  games,
  categories,
}: {
  asset: AidenAssetView;
  games: CatalogOption[];
  categories: CatalogOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState(asset.publishedProductSlug);

  const canPublish =
    asset.technicalStatus !== "CONCEPT_ONLY" && Boolean(asset.assetUrl) && !publishedSlug;

  return (
    <Card className="h-full">
      <CardTitle>{asset.title}</CardTitle>
      <CardDescription>
        {asset.game} · {aidenAssetTypeLabel(asset.assetType)} · {asset.previewLabel}
      </CardDescription>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="accent">{aidenTechnicalLabel(asset.technicalStatus)}</StatusPill>
        <StatusPill>{asset.moderation}</StatusPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {asset.assetUrl ? (
          <a
            href={asset.assetUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          >
            Preview
          </a>
        ) : (
          <Button size="sm" variant="secondary" disabled>
            Preview
          </Button>
        )}
        {publishedSlug ? (
          <Link
            href={`/market/${publishedSlug}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            View listing
          </Link>
        ) : (
          <Button size="sm" disabled={!canPublish} onClick={() => setShowForm((v) => !v)}>
            Publish to shop
          </Button>
        )}
      </div>
      {asset.technicalStatus === "CONCEPT_ONLY" ? (
        <p className="mt-2 text-xs text-muted">
          Concept-only assets cannot publish as game-ready listings.
        </p>
      ) : null}
      {showForm && canPublish ? (
        <PublishAssetForm
          publicRef={asset.publicRef}
          games={games}
          categories={categories}
          onDone={(slug) => {
            setPublishedSlug(slug);
            setShowForm(false);
          }}
        />
      ) : null}
    </Card>
  );
}
