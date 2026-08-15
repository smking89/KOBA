"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isBoostCurrentlyActive } from "@/features/boost/lib/state";

type BoostRow = {
  id: string;
  status: "UNUSED" | "APPLIED" | "EXPIRED";
  purchaseCoinCost: number;
  targetType: "PRODUCT" | "SHOP" | "GROUP" | null;
  targetId: string | null;
  expiresAt: string | null;
};

const TARGET_TYPES: BoostRow["targetType"][] = ["PRODUCT", "SHOP", "GROUP"];

export function BoostWalletPanel({ initialBoosts }: { initialBoosts: BoostRow[] }) {
  const [boosts, setBoosts] = useState(initialBoosts);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [applyTarget, setApplyTarget] = useState<
    Record<string, { targetType: NonNullable<BoostRow["targetType"]>; targetId: string }>
  >({});
  const [giftRecipient, setGiftRecipient] = useState<Record<string, string>>({});

  function buyBoost() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/boosts", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        boost?: BoostRow;
      };
      if (!response.ok || !payload.boost) {
        setError(payload.error ?? "Could not purchase a Boost.");
        return;
      }
      setBoosts((prev) => [payload.boost as BoostRow, ...prev]);
    });
  }

  function applyBoost(id: string) {
    const target = applyTarget[id];
    if (!target?.targetId?.trim()) {
      setError("Enter a target id to apply this Boost to.");
      return;
    }
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const response = await fetch(`/api/boosts/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: target.targetType, targetId: target.targetId.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        boost?: BoostRow;
      };
      setBusyId(null);
      if (!response.ok || !payload.boost) {
        setError(payload.error ?? "Could not apply this Boost.");
        return;
      }
      setBoosts((prev) => prev.map((b) => (b.id === id ? (payload.boost as BoostRow) : b)));
    });
  }

  function giftBoost(id: string) {
    const recipientUserId = giftRecipient[id]?.trim();
    if (!recipientUserId) {
      setError("Enter a recipient user id to gift this Boost.");
      return;
    }
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const response = await fetch(`/api/boosts/${id}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        boost?: BoostRow;
      };
      setBusyId(null);
      if (!response.ok) {
        setError(payload.error ?? "Could not gift this Boost.");
        return;
      }
      // Gifted away — no longer in this wallet's list.
      setBoosts((prev) => prev.filter((b) => b.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" size="sm" disabled={pending} onClick={buyBoost}>
        {pending ? "Working…" : "Buy a Boost (10 min, 3x exposure)"}
      </Button>

      {boosts.length === 0 ? (
        <p className="text-sm text-muted">No Boosts yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {boosts.map((boost) => (
            <li key={boost.id} className="space-y-2 py-3">
              <p className="text-sm">
                <span className="font-medium">
                  {boost.status === "APPLIED" && !isBoostCurrentlyActive(boost)
                    ? "EXPIRED"
                    : boost.status}
                </span>
                {boost.targetType ? ` · ${boost.targetType} ${boost.targetId}` : ""}
                {boost.expiresAt ? ` · expires ${new Date(boost.expiresAt).toLocaleTimeString()}` : ""}
              </p>
              {boost.status === "UNUSED" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-border bg-surface-2 px-2 text-sm"
                    value={applyTarget[boost.id]?.targetType ?? "PRODUCT"}
                    onChange={(event) =>
                      setApplyTarget((prev) => ({
                        ...prev,
                        [boost.id]: {
                          targetType: event.target.value as NonNullable<BoostRow["targetType"]>,
                          targetId: prev[boost.id]?.targetId ?? "",
                        },
                      }))
                    }
                  >
                    {TARGET_TYPES.map((type) => (
                      <option key={type} value={type ?? undefined}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="h-9 w-48"
                    placeholder="target id"
                    value={applyTarget[boost.id]?.targetId ?? ""}
                    onChange={(event) =>
                      setApplyTarget((prev) => ({
                        ...prev,
                        [boost.id]: {
                          targetType: prev[boost.id]?.targetType ?? "PRODUCT",
                          targetId: event.target.value,
                        },
                      }))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === boost.id}
                    onClick={() => applyBoost(boost.id)}
                  >
                    Apply
                  </Button>
                  <Input
                    className="h-9 w-48"
                    placeholder="gift to user id"
                    value={giftRecipient[boost.id] ?? ""}
                    onChange={(event) =>
                      setGiftRecipient((prev) => ({ ...prev, [boost.id]: event.target.value }))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === boost.id}
                    onClick={() => giftBoost(boost.id)}
                  >
                    Gift
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
