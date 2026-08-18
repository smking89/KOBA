"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/form-field";
import {
  FREEBIE_POLICIES,
  GAME_PLATFORMS,
  LISTING_TYPES,
  PLATFORM_LABEL,
  PRODUCT_RARITIES,
  RARITY_LABEL,
} from "@/features/marketplace/lib/catalog";
import {
  upsertProductSchema,
  type UpsertProductFormValues,
} from "@/features/shops/schemas/shop.schemas";

type CatalogOption = { slug: string; name: string };
type ServerOption = { id: string; name: string };

const FREEBIE_POLICY_LABEL: Record<(typeof FREEBIE_POLICIES)[number], string> = {
  NONE: "Not a freebie",
  PERMANENT: "Always free",
  LIMITED_QUANTITY: "Free while supplies last",
};

export function ProductForm({
  games,
  categories,
  servers,
  mode,
  slug,
  defaultValues,
}: {
  games: CatalogOption[];
  categories: CatalogOption[];
  servers: ServerOption[];
  mode: "create" | "edit";
  slug?: string;
  defaultValues?: Partial<UpsertProductFormValues>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UpsertProductFormValues>({
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
      freebiePolicy: "NONE",
      ...defaultValues,
    },
  });

  const listingType = watch("listingType");
  const freebiePolicy = watch("freebiePolicy");
  const rconServerId = watch("rconServerId");

  async function generateDescription() {
    const { title, gameSlug, categorySlug } = getValues();
    if (!title.trim()) {
      setDescribeError("Enter a title first.");
      return;
    }
    setDescribing(true);
    setDescribeError(null);
    const response = await fetch("/api/business/products/describe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        game: games.find((g) => g.slug === gameSlug)?.name ?? gameSlug,
        category: categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const payload = (await response.json()) as { description?: string; error?: string };
    setDescribing(false);
    if (!response.ok) {
      setDescribeError(payload.error ?? "Could not generate a description.");
      return;
    }
    if (payload.description) {
      setValue("description", payload.description, { shouldValidate: true });
    }
  }

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
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={describing}
            onClick={() => void generateDescription()}
          >
            {describing ? "Generating…" : "Generate with AI (1 Coin)"}
          </Button>
          {describeError ? <p className="text-xs text-destructive">{describeError}</p> : null}
        </div>
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
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="freebiePolicy" label="Freebie" error={errors.freebiePolicy?.message}>
          <select
            id="freebiePolicy"
            className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            {...register("freebiePolicy")}
          >
            {FREEBIE_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {FREEBIE_POLICY_LABEL[policy]}
              </option>
            ))}
          </select>
        </FormField>
        {freebiePolicy === "LIMITED_QUANTITY" ? (
          <FormField
            id="freebieQuantity"
            label="Free quantity"
            error={errors.freebieQuantity?.message}
          >
            <Input
              id="freebieQuantity"
              type="number"
              min={1}
              {...register("freebieQuantity", { valueAsNumber: true })}
            />
          </FormField>
        ) : null}
      </div>
      <fieldset className="space-y-2 rounded-md border border-white/10 p-4">
        <legend className="px-1 text-sm font-medium">
          Auto-deliver via RCON or plugin {listingType === "SUBSCRIPTION" ? "" : "(optional)"}
        </legend>
        <p className="text-xs text-muted">
          {listingType === "SUBSCRIPTION"
            ? "Required for a subscription — runs the grant command the moment a payment clears, and the expiry command the moment Stripe reports a cancellation or failed payment. Buyers deliver to whichever gamertag/PSN/Steam identity they've already linked in Settings."
            : "Instantly runs a kit-give command on one of your servers the moment payment clears, to whichever gamertag/PSN/Steam identity the buyer's already linked in Settings. Leave both blank for manual fulfillment."}
        </p>
        {servers.length === 0 ? (
          <p className="text-xs text-muted">
            No servers linked yet — add one in{" "}
            <Link href="/servers/manage" className="text-neon-lime hover:underline">
              Server Manage
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="rconServerId" label="Server" error={errors.rconServerId?.message}>
              <select
                id="rconServerId"
                className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
                {...register("rconServerId")}
              >
                <option value="">None</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </FormField>
            {rconServerId ? (
              <FormField
                id="rconKitName"
                label={listingType === "SUBSCRIPTION" ? "Grant kit name" : "Kit name"}
                error={errors.rconKitName?.message}
              >
                <Input id="rconKitName" placeholder="vip_grant" {...register("rconKitName")} />
              </FormField>
            ) : null}
            {rconServerId && listingType === "SUBSCRIPTION" ? (
              <>
                <FormField
                  id="expiryKitName"
                  label="Expiry kit name"
                  error={errors.expiryKitName?.message}
                >
                  <Input
                    id="expiryKitName"
                    placeholder="vip_revoke"
                    {...register("expiryKitName")}
                  />
                </FormField>
                <FormField
                  id="subscriptionInterval"
                  label="Billing interval"
                  error={errors.subscriptionInterval?.message}
                >
                  <select
                    id="subscriptionInterval"
                    className="flex h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
                    {...register("subscriptionInterval")}
                  >
                    <option value="">Select…</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </FormField>
              </>
            ) : null}
          </div>
        )}
      </fieldset>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
      </Button>
    </form>
  );
}
