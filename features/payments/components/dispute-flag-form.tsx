"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DisputeFlagForm({ publicRef }: { publicRef: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (reason.trim().length < 3) {
      setError("Tell us what went wrong (a few words is enough).");
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/orders/${publicRef}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not flag this order.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="What went wrong with this order?"
        rows={3}
      />
      <Button type="submit" size="sm" variant="danger" disabled={busy}>
        {busy ? "Reporting…" : "Report a problem"}
      </Button>
    </form>
  );
}
