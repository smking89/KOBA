"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type OwnedBanner = { ownershipId: string; name: string; equipped: boolean };

export function ShopBannerPanel({ initialBanners }: { initialBanners: OwnedBanner[] }) {
  const [banners, setBanners] = useState(initialBanners);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function equip(item: OwnedBanner) {
    setError(null);
    setPendingId(item.ownershipId);
    startTransition(async () => {
      const response = await fetch("/api/koba-shop/shop-banner/equip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cosmeticOwnershipId: item.ownershipId }),
      });
      setPendingId(null);
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not equip.");
        return;
      }
      setBanners((prev) => prev.map((b) => ({ ...b, equipped: b.ownershipId === item.ownershipId })));
    });
  }

  function unequip(item: OwnedBanner) {
    setError(null);
    setPendingId(item.ownershipId);
    startTransition(async () => {
      const response = await fetch("/api/koba-shop/shop-banner/unequip", { method: "POST" });
      setPendingId(null);
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not unequip.");
        return;
      }
      setBanners((prev) => prev.map((b) => (b.ownershipId === item.ownershipId ? { ...b, equipped: false } : b)));
    });
  }

  if (banners.length === 0) {
    return (
      <p className="text-sm text-muted">
        You don&apos;t own a Shop Banner cosmetic yet — buy one from the{" "}
        <Link href="/koba-shop" className="text-neon-lime hover:underline">
          KOBA Shop
        </Link>
        . Equipping needs an active KOBA Plus subscription.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-2">
        {banners.map((item) => (
          <li key={item.ownershipId} className="flex items-center justify-between rounded-md border border-white/10 p-3 text-sm">
            <p className="font-medium">{item.name}</p>
            {item.equipped ? (
              <Button type="button" variant="ghost" size="sm" disabled={pendingId === item.ownershipId} onClick={() => unequip(item)}>
                {pendingId === item.ownershipId ? "Unequipping…" : "Unequip"}
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" disabled={pendingId === item.ownershipId} onClick={() => equip(item)}>
                {pendingId === item.ownershipId ? "Equipping…" : "Equip"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
