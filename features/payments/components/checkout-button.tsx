"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CheckoutButton({
  slug,
  signedIn,
  label,
  disabled,
  requiresGameHandle,
}: {
  slug: string;
  signedIn: boolean;
  label: string;
  disabled?: boolean;
  /** Seller configured direct-RCON auto-delivery on this listing — the
   * buyer's gamertag is required for the kit-give command to target
   * the right player. */
  requiresGameHandle?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gameHandle, setGameHandle] = useState("");
  const [showHandlePrompt, setShowHandlePrompt] = useState(false);

  async function start(buyerGameHandle?: string) {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${slug}`);
      return;
    }
    if (requiresGameHandle && !buyerGameHandle) {
      setShowHandlePrompt(true);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        quantity: 1,
        idempotencyKey: crypto.randomUUID(),
        ...(buyerGameHandle ? { buyerGameHandle } : {}),
      }),
    });
    const payload = (await response.json()) as {
      url?: string | null;
      publicRef?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not start checkout.");
      return;
    }
    if (payload.url) {
      window.location.assign(payload.url);
      return;
    }
    if (payload.publicRef) {
      router.push(`/orders/${payload.publicRef}`);
    }
  }

  if (showHandlePrompt) {
    return (
      <div className="space-y-2">
        <label htmlFor="buyerGameHandle" className="text-xs text-muted">
          Your in-game gamertag — delivered automatically the moment payment clears.
        </label>
        <Input
          id="buyerGameHandle"
          value={gameHandle}
          onChange={(event) => setGameHandle(event.target.value)}
          placeholder="YourGamertag"
          autoFocus
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          onClick={() => void start(gameHandle.trim())}
          disabled={disabled || busy || gameHandle.trim().length === 0}
        >
          {busy ? "Redirecting…" : "Continue"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void start()} disabled={disabled || busy}>
        {busy ? "Redirecting…" : label}
      </Button>
    </div>
  );
}
