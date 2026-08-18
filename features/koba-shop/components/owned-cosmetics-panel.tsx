"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { COSMETIC_SUB_TYPE_LABEL, type CosmeticSubType } from "@/features/marketplace/lib/catalog";

type OwnedCosmetic = {
  ownershipId: string;
  cosmeticId: string;
  name: string;
  subType: CosmeticSubType;
  equipped: boolean;
};

export function OwnedCosmeticsPanel({
  initialCosmetics,
  hasPlus,
}: {
  initialCosmetics: OwnedCosmetic[];
  hasPlus: boolean;
}) {
  const [cosmetics, setCosmetics] = useState(initialCosmetics);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function equip(item: OwnedCosmetic) {
    setError(null);
    setPendingId(item.ownershipId);
    startTransition(async () => {
      const response = await fetch("/api/koba-shop/equip", {
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
      setCosmetics((prev) =>
        prev.map((c) => ({
          ...c,
          equipped: c.subType === item.subType ? c.ownershipId === item.ownershipId : c.equipped,
        })),
      );
    });
  }

  function unequip(item: OwnedCosmetic) {
    setError(null);
    setPendingId(item.ownershipId);
    startTransition(async () => {
      const response = await fetch("/api/koba-shop/unequip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subType: item.subType }),
      });
      setPendingId(null);
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not unequip.");
        return;
      }
      setCosmetics((prev) =>
        prev.map((c) => (c.ownershipId === item.ownershipId ? { ...c, equipped: false } : c)),
      );
    });
  }

  if (cosmetics.length === 0) {
    return (
      <p className="text-sm text-muted">
        No cosmetics owned yet — browse the{" "}
        <Link href="/koba-shop" className="text-neon-lime hover:underline">
          KOBA Shop
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!hasPlus ? (
        <p className="text-xs text-muted">
          Equipping needs an active KOBA Plus subscription — anything already equipped stays hidden
          until Plus resumes.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-2">
        {cosmetics.map((item) => (
          <li key={item.ownershipId} className="flex items-center justify-between rounded-md border border-white/10 p-3 text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted">{COSMETIC_SUB_TYPE_LABEL[item.subType]}</p>
            </div>
            {item.equipped ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === item.ownershipId}
                onClick={() => unequip(item)}
              >
                {pendingId === item.ownershipId ? "Unequipping…" : "Unequip"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!hasPlus || pendingId === item.ownershipId}
                onClick={() => equip(item)}
              >
                {pendingId === item.ownershipId ? "Equipping…" : "Equip"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
