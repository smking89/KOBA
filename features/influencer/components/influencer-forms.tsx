"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CreateReferralCodeForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/influencer/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug: slug }),
    });
    const payload = (await response.json()) as {
      code?: string;
      sharePath?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not create code.");
      return;
    }
    setMessage(payload.code ? `Code ${payload.code} ready.` : "Updated.");
    setSlug("");
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-electric-green">{message}</p> : null}
      <label className="block text-sm">
        Product slug
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
          placeholder="oil-rig-kit"
          required
          maxLength={96}
        />
      </label>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Creating…" : "Create referral code"}
      </Button>
    </form>
  );
}

export function RevokeReferralButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    await fetch(`/api/influencer/codes/${encodeURIComponent(code)}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void revoke()}>
      {busy ? "Revoking…" : "Revoke"}
    </Button>
  );
}

export function InfluencerPayoutButton({ onboarded }: { onboarded: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/influencer/payouts", { method: "POST" });
    const payload = (await response.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not start Stripe onboarding.");
      return;
    }
    if (payload.url) window.location.assign(payload.url);
  }

  async function refresh() {
    setBusy(true);
    await fetch("/api/influencer/payouts", { method: "PATCH" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void start()} disabled={busy} size="sm">
        {busy ? "Opening Stripe…" : onboarded ? "Update payouts" : "Connect payouts"}
      </Button>
      {onboarded ? (
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={busy}>
          Refresh status
        </Button>
      ) : null}
    </div>
  );
}
