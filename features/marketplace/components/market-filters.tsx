"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  PRODUCT_RARITIES,
  RARITY_LABEL,
  GAME_PLATFORMS,
  PLATFORM_LABEL,
} from "@/features/marketplace/lib/catalog";
import type { MarketQuery } from "@/features/marketplace/schemas/market.schemas";

type Option = { slug: string; name: string };

export function MarketFilters({
  query,
  games,
  categories,
}: {
  query: MarketQuery;
  games: Option[];
  categories: Option[];
}) {
  const router = useRouter();

  function apply(form: FormData) {
    const params = new URLSearchParams();
    const fields = ["q", "game", "category", "rarity", "platform", "listing", "sort"] as const;
    for (const field of fields) {
      const value = String(form.get(field) ?? "").trim();
      if (value) {
        params.set(field, value);
      }
    }
    if (form.get("freebie")) {
      params.set("freebie", "true");
    }
    const qs = params.toString();
    router.push(qs ? `/market?${qs}` : "/market");
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        apply(new FormData(event.currentTarget));
      }}
    >
      <Input
        name="q"
        defaultValue={query.q ?? ""}
        placeholder="Search skins, maps, monuments, cosmetics…"
        aria-label="Search marketplace"
      />
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect name="game" defaultValue={query.game ?? ""} aria-label="Game">
          <option value="">All games</option>
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="category" defaultValue={query.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="rarity" defaultValue={query.rarity ?? ""} aria-label="Rarity">
          <option value="">All rarities</option>
          {PRODUCT_RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_LABEL[rarity]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="platform" defaultValue={query.platform ?? ""} aria-label="Platform">
          <option value="">All platforms</option>
          {GAME_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_LABEL[platform]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="listing" defaultValue={query.listing ?? ""} aria-label="Listing type">
          <option value="">All listings</option>
          <option value="FIXED">Buy now</option>
          <option value="AUCTION">Auctions</option>
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={query.sort} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="price_asc">Price · low</option>
          <option value="price_desc">Price · high</option>
          <option value="rarity">Rarity</option>
        </NativeSelect>
        <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm">
          <input type="checkbox" name="freebie" defaultChecked={query.freebie === true} />
          Freebies only
        </label>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </div>
    </form>
  );
}
