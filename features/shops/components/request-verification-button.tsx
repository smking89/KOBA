"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RequestVerificationButton({ status }: { status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "VERIFIED" || status === "PENDING") {
    return null;
  }

  async function request() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/shops/verification", { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not request verification.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button variant="secondary" onClick={() => void request()} disabled={busy}>
        {busy ? "Requesting…" : "Request verification"}
      </Button>
    </div>
  );
}
