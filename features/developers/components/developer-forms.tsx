"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; secret?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

export function CreatePublisherForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/developers/profile", {
        displayName: form.get("displayName"),
        slug: form.get("slug"),
        description: form.get("description") ?? "",
        contactEmail: form.get("contactEmail"),
        websiteUrl: form.get("websiteUrl") || undefined,
        supportUrl: form.get("supportUrl") || undefined,
        privacyUrl: form.get("privacyUrl") || undefined,
        termsUrl: form.get("termsUrl") || undefined,
      });
      router.push("/developers/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create publisher.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" name="displayName" required minLength={2} maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          minLength={3}
          maxLength={48}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">Private contact email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Website</Label>
          <Input id="websiteUrl" name="websiteUrl" type="url" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supportUrl">Support URL</Label>
          <Input id="supportUrl" name="supportUrl" type="url" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="privacyUrl">Privacy policy</Label>
          <Input id="privacyUrl" name="privacyUrl" type="url" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="termsUrl">Terms</Label>
          <Input id="termsUrl" name="termsUrl" type="url" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create publisher"}
      </Button>
    </form>
  );
}

export function SecretReveal({ label, secret }: { label: string; secret: string }) {
  return (
    <div className="rounded-md border border-neon-lime/40 bg-surface-2 p-3">
      <p className="text-xs text-muted">{label} — copy now. It will not be shown again.</p>
      <p className="mt-2 break-all font-mono text-sm text-foreground">{secret}</p>
    </div>
  );
}

export function CreateApplicationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const scopes = form.getAll("scopes");
    try {
      await postJson("/api/developers/applications", {
        name: form.get("name"),
        description: form.get("description") ?? "",
        environment: "SANDBOX",
        scopes,
        redirectUris: String(form.get("redirectUris") ?? "")
          .split(/\s+/)
          .filter(Boolean),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create application.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Application name</Label>
        <Input id="name" name="name" required minLength={2} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm">Scopes</legend>
        {["profile:read", "servers:read", "products:read", "orders:read", "webhooks:manage"].map(
          (scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="scopes" value={scope} className="accent-[#B8FF00]" />
              <span className="font-mono">{scope}</span>
            </label>
          ),
        )}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="redirectUris">Redirect URIs (OAuth deferred — stored only)</Label>
        <Input id="redirectUris" name="redirectUris" placeholder="https://example.com/callback" />
      </div>
      <Button type="submit" disabled={pending}>
        Create sandbox app
      </Button>
    </form>
  );
}

export function CreateApiKeyForm({
  applications,
}: {
  applications: { publicRef: string; name: string }[];
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await postJson("/api/developers/api-keys", {
        applicationRef: form.get("applicationRef"),
        name: form.get("name"),
        scopes: form.getAll("scopes"),
      });
      setSecret(result.secret ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {secret ? <SecretReveal label="API key" secret={secret} /> : null}
      <div className="space-y-2">
        <Label htmlFor="applicationRef">Application</Label>
        <select
          id="applicationRef"
          name="applicationRef"
          className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          required
        >
          {applications.map((app) => (
            <option key={app.publicRef} value={app.publicRef}>
              {app.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="keyName">Key name</Label>
        <Input id="keyName" name="name" required />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm">Scopes</legend>
        {["profile:read", "servers:read", "products:read", "orders:read", "webhooks:manage"].map(
          (scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="scopes"
                value={scope}
                defaultChecked={scope === "profile:read"}
                className="accent-[#B8FF00]"
              />
              <span className="font-mono">{scope}</span>
            </label>
          ),
        )}
      </fieldset>
      <Button type="submit">Generate key</Button>
    </form>
  );
}

export function CreateProductForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("GAME_SERVER_PLUGIN");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/developers/products", {
        kind: form.get("kind"),
        category: form.get("category"),
        name: form.get("name"),
        slug: form.get("slug") || undefined,
        shortDescription: form.get("shortDescription") ?? "",
        description: form.get("description") ?? "",
        pricing: form.get("pricing"),
        priceCoins:
          form.get("pricing") === "PAID" ? String(form.get("priceCoins") || "40") : undefined,
        games: String(form.get("games") ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        discordInviteUrl:
          form.get("category") === "DISCORD_BOT" ? form.get("discordInviteUrl") || undefined : undefined,
      });
      router.push("/developers/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create product.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="productName">Name</Label>
        <Input id="productName" name="name" required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Kind</Label>
          <select
            id="kind"
            name="kind"
            className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          >
            <option value="PLUGIN">Plugin</option>
            <option value="APPLICATION">Application</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          >
            <option value="GAME_SERVER_PLUGIN">Game-server plugin</option>
            <option value="DISCORD_BOT">Discord bot</option>
            <option value="SERVER_MANAGEMENT">Server management</option>
            <option value="INTEGRATION">Integration</option>
            <option value="DOWNLOADABLE_PACK">Downloadable pack</option>
            <option value="API_SERVICE">API service</option>
            <option value="UTILITY">Utility</option>
            <option value="THEME">Theme or template</option>
          </select>
        </div>
      </div>
      {category === "DISCORD_BOT" ? (
        <div className="space-y-2">
          <Label htmlFor="discordInviteUrl">Bot invite link</Label>
          <Input
            id="discordInviteUrl"
            name="discordInviteUrl"
            placeholder="https://discord.com/oauth2/authorize?client_id=...&scope=bot"
            required
          />
          <p className="text-xs text-muted">
            The real OAuth2 invite link from your bot&rsquo;s Discord Developer Portal page — this
            is what users click to add it to their own server.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="shortDescription">Short description</Label>
        <Input id="shortDescription" name="shortDescription" maxLength={160} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Full description</Label>
        <Textarea id="description" name="description" rows={6} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pricing">Pricing</Label>
          <select
            id="pricing"
            name="pricing"
            className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
          >
            <option value="FREE">Free</option>
            <option value="PAID">Paid (KOBA Coins)</option>
            <option value="COMING_SOON">Coming soon</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceCoins">KOBA Coin price</Label>
          <Input id="priceCoins" name="priceCoins" inputMode="numeric" defaultValue="40" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="games">Supported games (comma-separated)</Label>
        <Input id="games" name="games" placeholder="Rust, Minecraft" />
      </div>
      <Button type="submit">Save draft</Button>
    </form>
  );
}

export function PurchaseButton({
  slug,
  pricing,
  priceLabel,
  owned,
}: {
  slug: string;
  pricing: string;
  priceLabel: string;
  owned: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (owned) {
    return <p className="text-sm text-neon-mint">You own this product.</p>;
  }
  if (pricing === "COMING_SOON") {
    return <p className="text-sm text-muted">Coming soon.</p>;
  }

  async function buy() {
    setPending(true);
    setError(null);
    try {
      await postJson(`/api/apps/${encodeURIComponent(slug)}/purchase`, {
        idempotencyKey: `web-${slug}-${Date.now()}`.slice(0, 64).padEnd(8, "0"),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={pending} onClick={() => void buy()}>
        {pricing === "FREE" ? "Get free" : `Buy for ${priceLabel}`}
      </Button>
    </div>
  );
}

/** Publisher socials bio block (App Store submission flow, 2026-08-18:
 * "they can input there website and socials via there app store bio"). */
export function SocialsForm({
  twitterUrl,
  githubUrl,
  youtubeUrl,
  discordServerUrl,
}: {
  twitterUrl: string | null;
  githubUrl: string | null;
  youtubeUrl: string | null;
  discordServerUrl: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/developers/socials", {
        twitterUrl: form.get("twitterUrl") || undefined,
        githubUrl: form.get("githubUrl") || undefined,
        youtubeUrl: form.get("youtubeUrl") || undefined,
        discordServerUrl: form.get("discordServerUrl") || undefined,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save socials.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-neon-mint">Saved.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="twitterUrl">X / Twitter</Label>
          <Input id="twitterUrl" name="twitterUrl" defaultValue={twitterUrl ?? ""} placeholder="https://x.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="githubUrl">GitHub</Label>
          <Input id="githubUrl" name="githubUrl" defaultValue={githubUrl ?? ""} placeholder="https://github.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="youtubeUrl">YouTube</Label>
          <Input id="youtubeUrl" name="youtubeUrl" defaultValue={youtubeUrl ?? ""} placeholder="https://youtube.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discordServerUrl">Discord server</Label>
          <Input
            id="discordServerUrl"
            name="discordServerUrl"
            defaultValue={discordServerUrl ?? ""}
            placeholder="https://discord.gg/..."
          />
        </div>
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Save socials
      </Button>
    </form>
  );
}
