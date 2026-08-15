"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ShopPromoConfig } from "@/lib/generated/prisma/client";

export function ShopPromoForm({ promoConfig }: { promoConfig: ShopPromoConfig | null }) {
  const router = useRouter();
  const [influencerEligible, setInfluencerEligible] = useState(
    promoConfig?.influencerEligible ?? false,
  );
  const [payoutType, setPayoutType] = useState<"PERCENT" | "FIXED">(
    promoConfig?.payoutType ?? "PERCENT",
  );
  const [payoutValue, setPayoutValue] = useState(String(promoConfig?.payoutValue ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const response = await fetch("/api/business/promo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        influencerEligible,
        payoutType,
        payoutValue: Number(payoutValue),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not update promo settings.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardTitle>Promo settings</CardTitle>
      <CardDescription>
        Enable influencer eligibility and set a payout rate for products in this shop — the
        shop-side half of the influencer promo system.
      </CardDescription>
      <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={influencerEligible}
            onChange={(event) => setInfluencerEligible(event.target.checked)}
          />
          Eligible for influencer promotion
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={payoutType}
            onChange={(event) => setPayoutType(event.target.value as "PERCENT" | "FIXED")}
            aria-label="Payout type"
            className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
          >
            <option value="PERCENT">Percent (basis points)</option>
            <option value="FIXED">Fixed (cents)</option>
          </select>
          <Input
            value={payoutValue}
            onChange={(event) => setPayoutValue(event.target.value)}
            aria-label="Payout value"
            type="number"
            min={0}
            className="w-40"
          />
          <span className="text-xs text-muted">
            {payoutType === "PERCENT" ? "0–10000 = 0%–100%" : "cents"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save promo settings"}
          </Button>
          {saved ? <span className="text-sm text-neon-lime">Saved.</span> : null}
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}
