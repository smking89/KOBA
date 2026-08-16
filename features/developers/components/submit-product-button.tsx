"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SubmitProductButton({ publicRef }: { publicRef: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const response = await fetch(
      `/api/developers/products/${encodeURIComponent(publicRef)}/submit`,
      {
        method: "POST",
        headers: { "Cache-Control": "no-store" },
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not submit.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" onClick={() => void submit()}>
        Submit for review
      </Button>
    </div>
  );
}
