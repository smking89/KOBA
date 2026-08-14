"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function OrderActionButton({
  publicRef,
  action,
  label,
}: {
  publicRef: string;
  action: "refund" | "fulfill";
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/business/orders/${publicRef}/${action}`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not update order.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button
        size="sm"
        variant={action === "refund" ? "danger" : "secondary"}
        onClick={() => void run()}
        disabled={busy}
      >
        {busy ? "Working…" : label}
      </Button>
    </div>
  );
}
