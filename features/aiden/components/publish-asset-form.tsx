"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GAME_PLATFORMS,
  LISTING_TYPES,
  PLATFORM_LABEL,
  PRODUCT_RARITIES,
  RARITY_LABEL,
} from "@/features/marketplace/lib/catalog";

type CatalogOption = { slug: string; name: string };

export function PublishAssetForm({
  publicRef,
  games,
  categories,
  onDone,
}: {
  publicRef: string;
  games: CatalogOption[];
  categories: CatalogOption[];
  onDone: (publishedProductSlug: string) => void;
}) {
  const router = useRouter();
  const [gameSlug, setGameSlug] = useState(games[0]?.slug ?? "");
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [priceCents, setPriceCents] = useState(1000);
  const [rarity, setRarity] = useState<(typeof PRODUCT_RARITIES)[number]>("COMMON");
  const [listingType, setListingType] = useState<(typeof LISTING_TYPES)[number]>("FIXED");
  const [inventoryQty, setInventoryQty] = useState(1);
  const [platforms, setPlatforms] = useState<string[]>(["STEAM"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlatform(platform: string) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  async function submit() {
    if (platforms.length === 0) {
      setError("Choose at least one platform.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/aiden/library/${publicRef}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameSlug,
        categorySlug,
        priceCents,
        rarity,
        listingType,
        inventoryQty,
        platforms,
        durationHours: 48,
        minIncrementCents: 1000,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      publishedProductSlug?: string;
    };
    setSubmitting(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not publish this asset.");
      return;
    }
    if (payload.publishedProductSlug) {
      onDone(payload.publishedProductSlug);
      router.refresh();
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border bg-surface-2 p-3">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <select
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          value={gameSlug}
          onChange={(event) => setGameSlug(event.target.value)}
        >
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          value={rarity}
          onChange={(event) => setRarity(event.target.value as (typeof PRODUCT_RARITIES)[number])}
        >
          {PRODUCT_RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          value={listingType}
          onChange={(event) =>
            setListingType(event.target.value as (typeof LISTING_TYPES)[number])
          }
        >
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === "AUCTION" ? "Auction" : "Fixed price"}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          className="h-9"
          placeholder="Price (cents)"
          value={priceCents}
          onChange={(event) => setPriceCents(Number(event.target.value))}
        />
        <Input
          type="number"
          min={0}
          className="h-9"
          placeholder="Inventory"
          value={inventoryQty}
          onChange={(event) => setInventoryQty(Number(event.target.value))}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {GAME_PLATFORMS.map((platform) => (
          <label key={platform} className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={platforms.includes(platform)}
              onChange={() => togglePlatform(platform)}
            />
            {PLATFORM_LABEL[platform]}
          </label>
        ))}
      </div>
      <Button type="button" size="sm" disabled={submitting} onClick={() => void submit()}>
        {submitting ? "Publishing…" : "Publish as draft listing"}
      </Button>
    </div>
  );
}
