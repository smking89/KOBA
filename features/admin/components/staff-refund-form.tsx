"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffRefundForm({ canRefund }: { canRefund: boolean }) {
  const [pending, startTransition] = useTransition();
  const [publicRef, setPublicRef] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canRefund) {
    return <p className="text-sm text-muted">Only Admin or Superadmin can issue staff refunds.</p>;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const ref = publicRef.trim();
    if (!ref) {
      setError("Enter an order public ref.");
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(ref)}/refund`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        publicRef?: string;
        status?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Could not refund order.");
        return;
      }
      setMessage(`Refunded ${payload.publicRef} → ${payload.status}.`);
      setPublicRef("");
    });
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-neon-mint">{message}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="order-ref">Order public ref</Label>
        <Input
          id="order-ref"
          value={publicRef}
          onChange={(event) => setPublicRef(event.target.value)}
          placeholder="KOBA-ORD-…"
          className="font-mono"
        />
      </div>
      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        Refund order
      </Button>
    </form>
  );
}
