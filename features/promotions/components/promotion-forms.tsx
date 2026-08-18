"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export function ActionButton({
  url,
  body,
  label,
  variant = "secondary",
}: {
  url: string;
  body: unknown;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await postJson(url, body);
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Failed.");
          } finally {
            setPending(false);
          }
        }}
      >
        {label}
      </Button>
      {error ? <span className="text-xs text-warning">{error}</span> : null}
    </span>
  );
}

export function ProfileForm({
  initial,
}: {
  initial: {
    displayName: string;
    bio: string;
    contactEmail: string | null;
    games: string[];
    categories: string[];
    audienceRegions: string[];
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        const response = await fetch("/api/influencer/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: form.get("displayName"),
            bio: form.get("bio"),
            contactEmail: String(form.get("contactEmail") || "") || null,
            games: String(form.get("games") || "")
              .split(",")
              .map((row) => row.trim())
              .filter(Boolean),
            categories: String(form.get("categories") || "")
              .split(",")
              .map((row) => row.trim())
              .filter(Boolean),
            audienceRegions: String(form.get("audienceRegions") || "")
              .split(",")
              .map((row) => row.trim())
              .filter(Boolean),
            socialLinks: [],
            acceptDisclosure: form.get("acceptDisclosure") === "on",
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Could not save profile.");
          return;
        }
        router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        Display name
        <input
          name="displayName"
          required
          defaultValue={initial.displayName}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Bio
        <textarea
          name="bio"
          defaultValue={initial.bio}
          rows={4}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Private contact email
        <input
          name="contactEmail"
          type="email"
          defaultValue={initial.contactEmail ?? ""}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Games (comma separated)
        <input
          name="games"
          defaultValue={initial.games.join(", ")}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Categories
        <input
          name="categories"
          defaultValue={initial.categories.join(", ")}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Audience regions
        <input
          name="audienceRegions"
          defaultValue={initial.audienceRegions.join(", ")}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptDisclosure" />I will disclose paid promotions.
      </label>
      {error ? <p className="text-sm text-warning">{error}</p> : null}
      <Button type="submit">Save profile</Button>
    </form>
  );
}

export function CampaignCreateForm({
  products,
}: {
  products: Array<{ slug: string; title: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const productSlugs = form.getAll("productSlugs").map(String);
        const response = await fetch("/api/seller/promotions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            productSlugs,
            commissionType: form.get("commissionType"),
            commissionValue: Number(form.get("commissionValue")),
            totalBudgetCents: Math.round(Number(form.get("budgetDollars") || 0) * 100),
            attributionWindowHours: Number(form.get("windowHours") || 168),
            openApplications: form.get("openApplications") === "on",
            terms: form.get("terms"),
          }),
        });
        const data = (await response.json()) as { error?: string; campaign?: { id: string } };
        if (!response.ok || !data.campaign) {
          setError(data.error ?? "Could not create campaign.");
          return;
        }
        router.push(`/seller/promotions/${data.campaign.id}`);
      }}
    >
      <label className="grid gap-1 text-sm">
        Campaign name
        <input
          name="name"
          required
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend>Eligible products</legend>
        {products.map((product) => (
          <label key={product.slug} className="flex items-center gap-2">
            <input type="checkbox" name="productSlugs" value={product.slug} />
            {product.title}
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1 text-sm">
        Commission type
        <select
          name="commissionType"
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        >
          <option value="PERCENTAGE">Percentage (bps)</option>
          <option value="FIXED">Fixed cents</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Commission value
        <input
          name="commissionValue"
          type="number"
          defaultValue={1000}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Total budget (USD)
        <input
          name="budgetDollars"
          type="number"
          min={0}
          step="0.01"
          defaultValue={100}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Attribution window (hours)
        <input
          name="windowHours"
          type="number"
          defaultValue={168}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="openApplications" defaultChecked />
        Open applications
      </label>
      <label className="grid gap-1 text-sm">
        Terms
        <textarea
          name="terms"
          rows={4}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-warning">{error}</p> : null}
      <Button type="submit">Create draft</Button>
    </form>
  );
}

export function PromoCodeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/seller/promo-codes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: form.get("code"),
            discountType: form.get("discountType"),
            discountValue: Number(form.get("discountValue")),
            usageLimit: Number(form.get("usageLimit") || 0) || null,
            perAccountLimit: Number(form.get("perAccountLimit") || 1),
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Could not create code.");
          return;
        }
        router.refresh();
        event.currentTarget.reset();
      }}
    >
      <label className="grid gap-1 text-sm">
        Code
        <input
          name="code"
          required
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Discount type
        <select
          name="discountType"
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        >
          <option value="PERCENTAGE">Percentage (bps)</option>
          <option value="FIXED">Fixed cents</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Discount value
        <input
          name="discountValue"
          type="number"
          defaultValue={1000}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Usage limit
        <input
          name="usageLimit"
          type="number"
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-warning">{error}</p> : null}
      <Button type="submit">Create promo code</Button>
    </form>
  );
}

export function AdCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/seller/ads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entityType: form.get("entityType"),
            entityId: form.get("entityId"),
            placement: form.get("placement"),
            totalBudgetCoins: Number(form.get("totalBudgetCoins")),
            dailyBudgetCoins: Number(form.get("dailyBudgetCoins")),
            cpcCoins: Number(form.get("cpcCoins") || 5),
            frequencyCap: Number(form.get("frequencyCap") || 6),
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Could not create ad.");
          return;
        }
        router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        Entity type
        <select
          name="entityType"
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        >
          <option value="PRODUCT">Product</option>
          <option value="SHOP">Shop</option>
          <option value="DEV_PRODUCT">Developer product</option>
          <option value="GAME_SERVER">Game server</option>
          <option value="GROUP">Group</option>
          <option value="INFLUENCER">Creator profile</option>
          <option value="LFG">LFG post</option>
          <option value="COSMETIC">KOBA Shop cosmetic</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Entity id or slug
        <input
          name="entityId"
          required
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Placement
        <select name="placement" className="rounded-md border border-border bg-surface-2 px-3 py-2">
          <option value="MARKETPLACE">Marketplace</option>
          <option value="SHOP">Shop</option>
          <option value="APPS">Apps</option>
          <option value="SERVERS">Servers</option>
          <option value="FEED">Social feed</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Total KOBA Coin budget
        <input
          name="totalBudgetCoins"
          type="number"
          defaultValue={100}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Daily budget
        <input
          name="dailyBudgetCoins"
          type="number"
          defaultValue={20}
          className="rounded-md border border-border bg-surface-2 px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-warning">{error}</p> : null}
      <Button type="submit">Create draft ad</Button>
    </form>
  );
}

export function InviteForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await fetch(`/api/seller/promotions/${campaignId}/invite`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle: form.get("handle") }),
        });
        router.refresh();
      }}
    >
      <input
        name="handle"
        placeholder="influencer handle"
        className="rounded-md border border-border bg-surface-2 px-3 py-2"
      />
      <Button type="submit" size="sm">
        Invite
      </Button>
    </form>
  );
}
