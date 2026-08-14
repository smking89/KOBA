"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectOnboardButton({ onboarded }: { onboarded: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/business/connect", { method: "POST" });
    const payload = (await response.json()) as { url?: string; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not start Stripe onboarding.");
      return;
    }
    if (payload.url) {
      window.location.assign(payload.url);
    }
  }

  async function refresh() {
    setBusy(true);
    await fetch("/api/business/connect/refresh", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void start()} disabled={busy}>
        {busy ? "Opening Stripe…" : onboarded ? "Update payouts" : "Connect payouts"}
      </Button>
      {onboarded ? (
        <Button variant="secondary" onClick={() => void refresh()} disabled={busy}>
          Refresh status
        </Button>
      ) : null}
    </div>
  );
}
