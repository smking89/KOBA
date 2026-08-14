"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  slug,
  signedIn,
  label,
  disabled,
}: {
  slug: string;
  signedIn: boolean;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${slug}`);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, quantity: 1, idempotencyKey: crypto.randomUUID() }),
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

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void start()} disabled={disabled || busy}>
        {busy ? "Redirecting…" : label}
      </Button>
    </div>
  );
}
