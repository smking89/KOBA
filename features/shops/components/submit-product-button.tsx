"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SubmitProductButton({ slug, status }: { slug: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== "DRAFT" && status !== "REJECTED") {
    return null;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/business/products/${slug}/submit`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not submit listing.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button size="sm" variant="secondary" onClick={() => void submit()} disabled={busy}>
        {busy ? "Submitting…" : "Submit for review"}
      </Button>
    </div>
  );
}
