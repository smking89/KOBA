"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowMain,
  ListRowMeta,
} from "@/components/dashboard/list-panel";

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
    return <ListPanelEmpty>Only Admin or Superadmin can resolve disputes.</ListPanelEmpty>;
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
    return <ListPanelEmpty>No disputed orders.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {orders.map((order) => (
          <ListRow key={order.publicRef}>
            <ListRowMain>
              <p className="font-mono text-xs text-neon-lime">{order.publicRef}</p>
              <p className="text-sm text-foreground">
                {order.shopName} · {(order.totalCents / 100).toFixed(2)} {order.currency}
              </p>
              <ListRowMeta className="text-sm">{order.disputeReason}</ListRowMeta>
              <ListRowMeta>
                {order.disputedByHandle ? `@${order.disputedByHandle}` : "buyer"}
                {order.disputedAt ? ` · ${new Date(order.disputedAt).toLocaleString()}` : ""}
              </ListRowMeta>
            </ListRowMain>
            <ListRowActions>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void resolve(order.publicRef, "RELEASE")}
              >
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
            </ListRowActions>
          </ListRow>
        ))}
      </ListPanel>
    </div>
  );
}
