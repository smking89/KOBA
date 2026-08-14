"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
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
    const fields = ["q", "game", "category", "rarity", "platform", "sort"] as const;
    for (const field of fields) {
      const value = String(form.get(field) ?? "").trim();
      if (value) {
        params.set(field, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `/market?${qs}` : "/market");
  }

  return (
    <form
      className="space-y-3"
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
      <div className="flex flex-wrap gap-2">
        <select
          name="game"
          defaultValue={query.game ?? ""}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
          aria-label="Game"
        >
          <option value="">All games</option>
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={query.category ?? ""}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="rarity"
          defaultValue={query.rarity ?? ""}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
          aria-label="Rarity"
        >
          <option value="">All rarities</option>
          {PRODUCT_RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_LABEL[rarity]}
            </option>
          ))}
        </select>
        <select
          name="platform"
          defaultValue={query.platform ?? ""}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
          aria-label="Platform"
        >
          <option value="">All platforms</option>
          {GAME_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_LABEL[platform]}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={query.sort}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
          aria-label="Sort"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price · low</option>
          <option value="price_desc">Price · high</option>
          <option value="rarity">Rarity</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-brand-gradient px-4 text-sm font-semibold text-background"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
