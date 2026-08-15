"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type DisputedOrder = {
  publicRef: string;
  totalCents: number;
  currency: string;
  shopName: string;
  shopSlug: string;
  disputedAt: string | null;
  disputeReason: string | null;
  disputedByHandle: string | null;
  disputedByEmail: string | null;
};

export function DisputedOrdersPanel({
  orders,
  canResolve,
}: {
  orders: DisputedOrder[];
  canResolve: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canResolve) {
    return <p className="text-sm text-muted">Only Admin or Superadmin can resolve disputes.</p>;
  }

  async function resolve(publicRef: string, resolution: "RELEASE" | "REFUND") {
    setError(null);
    const response = await fetch(
      `/api/admin/orders/${encodeURIComponent(publicRef)}/resolve-dispute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not resolve dispute.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (orders.length === 0) {
    return <p className="text-sm text-muted">No disputed orders.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {orders.map((order) => (
          <li key={order.publicRef} className="space-y-2 px-4 py-3">
            <div className="space-y-1">
              <p className="font-mono text-xs text-neon-lime">{order.publicRef}</p>
              <p className="text-sm text-foreground">
                {order.shopName} · {(order.totalCents / 100).toFixed(2)} {order.currency}
              </p>
              <p className="text-sm text-muted">{order.disputeReason}</p>
              <p className="text-xs text-muted">
                {order.disputedByHandle ? `@${order.disputedByHandle}` : "buyer"}
                {order.disputedAt ? ` · ${new Date(order.disputedAt).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending} onClick={() => void resolve(order.publicRef, "RELEASE")}>
                Release to seller
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => void resolve(order.publicRef, "REFUND")}
              >
                Refund buyer
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
