"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ClaimFreebieButton({
  slug,
  signedIn,
  disabled,
  alreadyClaimed,
}: {
  slug: string;
  signedIn: boolean;
  disabled?: boolean;
  alreadyClaimed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(alreadyClaimed);

  async function claim() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${slug}`);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/market/products/${slug}/claim-freebie`, {
      method: "POST",
    });
    const payload = (await response.json()) as { publicRef?: string; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not claim this freebie.");
      return;
    }
    setClaimed(true);
    if (payload.publicRef) {
      router.push(`/orders/${payload.publicRef}`);
    }
  }

  const label = claimed ? "Claimed" : busy ? "Claiming…" : "Claim for free";

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={() => void claim()} disabled={disabled || busy || claimed}>
        {label}
      </Button>
    </div>
  );
}
