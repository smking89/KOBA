"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CoinPackage } from "@/features/wallet/lib/coin-packages";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BuyCoinsPanel({ packages }: { packages: readonly CoinPackage[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packageId: string) {
    setBusyId(packageId);
    setError(null);

    const response = await fetch("/api/wallet/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId, idempotencyKey: crypto.randomUUID() }),
    });
    const payload = (await response.json()) as { url?: string | null; error?: string };
    setBusyId(null);

    if (!response.ok) {
      setError(payload.error ?? "Could not start Coin purchase.");
      return;
    }
    if (payload.url) {
      window.location.assign(payload.url);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((pack) => (
          <div
            key={pack.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-4"
          >
            <p className="text-sm font-semibold">{pack.label}</p>
            <p className="font-mono text-lg tabular-nums">{pack.coinAmount.toString()} Coins</p>
            <Button
              size="sm"
              className="mt-2"
              disabled={busyId !== null}
              onClick={() => void buy(pack.id)}
            >
              {busyId === pack.id ? "Redirecting…" : `Buy for ${formatPrice(pack.priceCents)}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
