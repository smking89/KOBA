"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/form-field";
import {
  GAME_PLATFORMS,
  LISTING_TYPES,
  PLATFORM_LABEL,
  PRODUCT_RARITIES,
  RARITY_LABEL,
} from "@/features/marketplace/lib/catalog";
import {
  upsertProductSchema,
  type UpsertProductInput,
} from "@/features/shops/schemas/shop.schemas";

type CatalogOption = { slug: string; name: string };

export function ProductForm({
  games,
  categories,
  mode,
  slug,
  defaultValues,
}: {
  games: CatalogOption[];
  categories: CatalogOption[];
  mode: "create" | "edit";
  slug?: string;
  defaultValues?: Partial<UpsertProductInput>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpsertProductInput>({
    resolver: zodResolver(upsertProductSchema),
    defaultValues: {
      listingType: "FIXED",
      rarity: "COMMON",
      priceCents: 1000,
      inventoryQty: 1,
      platforms: ["STEAM"],
      gameSlug: games[0]?.slug ?? "",
      categorySlug: categories[0]?.slug ?? "",
      durationHours: 48,
      minIncrementCents: 1000,
      ...defaultValues,
    },
  });

  const listingType = watch("listingType");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const url = mode === "create" ? "/api/business/products" : `/api/business/products/${slug}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string; slug?: string };
    if (!response.ok) {
      setFormError(payload.error ?? "Could not save listing.");
      return;
    }
    router.push("/business/products");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <FormField id="title" label="Title" error={errors.title?.message}>
        <Input id="title" maxLength={80} {...register("title")} />
      </FormField>
      <FormField id="description" label="Description" error={errors.description?.message}>
        <Textarea id="description" rows={5} maxLength={4000} {...register("description")} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="gameSlug" label="Game" error={errors.gameSlug?.message}>
          <select
            id="gameSlug"
            className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            {...register("gameSlug")}
          >
            {games.map((game) => (
              <option key={game.slug} value={game.slug}>
                {game.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="categorySlug" label="Category" error={errors.categorySlug?.message}>
          <select
            id="categorySlug"
            className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            {...register("categorySlug")}
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="rarity" label="Rarity" error={errors.rarity?.message}>
          <select
            id="rarity"
            className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            {...register("rarity")}
          >
            {PRODUCT_RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>
                {RARITY_LABEL[rarity]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="listingType" label="Listing type" error={errors.listingType?.message}>
          <select
            id="listingType"
            className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            {...register("listingType")}
          >
            {LISTING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "AUCTION" ? "Auction" : "Fixed price"}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="priceCents" label="Price (cents)" error={errors.priceCents?.message}>
          <Input
            id="priceCents"
            type="number"
            min={0}
            {...register("priceCents", { valueAsNumber: true })}
          />
        </FormField>
        <FormField id="inventoryQty" label="Inventory" error={errors.inventoryQty?.message}>
          <Input
            id="inventoryQty"
            type="number"
            min={0}
            {...register("inventoryQty", { valueAsNumber: true })}
          />
        </FormField>
        {listingType === "AUCTION" ? (
          <>
            <FormField
              id="durationHours"
              label="Duration (hours)"
              error={errors.durationHours?.message}
            >
              <Input
                id="durationHours"
                type="number"
                min={1}
                max={168}
                {...register("durationHours", { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              id="minIncrementCents"
              label="Min increment (cents)"
              error={errors.minIncrementCents?.message}
            >
              <Input
                id="minIncrementCents"
                type="number"
                min={100}
                {...register("minIncrementCents", { valueAsNumber: true })}
              />
            </FormField>
          </>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Platforms</legend>
        {errors.platforms?.message ? (
          <p className="text-xs text-destructive">{errors.platforms.message}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {GAME_PLATFORMS.map((platform) => (
            <label key={platform} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={platform} {...register("platforms")} />
              {PLATFORM_LABEL[platform]}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
      </Button>
    </form>
  );
}
