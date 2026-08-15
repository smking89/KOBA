"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PromoPayoutType, ShopPromoView } from "@/features/influencer/lib/types";

export function ShopPromoForm({ initial }: { initial: ShopPromoView }) {
  const router = useRouter();
  const [eligible, setEligible] = useState(initial.influencerEligible);
  const [payoutType, setPayoutType] = useState<PromoPayoutType>(initial.payoutType);
  const [payoutValue, setPayoutValue] = useState(String(initial.payoutValue));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/business/promo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        influencerEligible: eligible,
        payoutType,
        payoutValue: Number.parseInt(payoutValue, 10),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save promo terms.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={eligible}
          onChange={(event) => setEligible(event.target.checked)}
        />
        Allow influencer referral codes on this shop
      </label>
      <label className="block text-sm">
        Payout type
        <select
          value={payoutType}
          onChange={(event) => setPayoutType(event.target.value as PromoPayoutType)}
          className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          <option value="PERCENT_BPS">Percent of order (basis points)</option>
          <option value="FIXED_CENTS">Fixed amount (cents)</option>
        </select>
      </label>
      <label className="block text-sm">
        {payoutType === "PERCENT_BPS" ? "Basis points (1000 = 10%)" : "Amount in cents"}
        <input
          value={payoutValue}
          onChange={(event) => setPayoutValue(event.target.value)}
          inputMode="numeric"
          className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
        />
      </label>
      <p className="text-xs text-muted">
        Paid from the shop’s remaining payout after the KOBA platform fee. Influencer payouts never
        drive the shop negative. Terms are set by the shop, not the influencer.
      </p>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Saving…" : "Save promo terms"}
      </Button>
    </form>
  );
}
