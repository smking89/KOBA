"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { MOCK_TRADE_INVENTORY, MOCK_TRADES } from "@/features/trade/lib/catalog";
import { sameRarityTier, tradeStateLabel } from "@/features/trade/lib/types";
import { RARITY_LABEL } from "@/features/marketplace/lib/catalog";

export function TradeHub() {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<string>("ALL");
  const [offerIds, setOfferIds] = useState<string[]>(["inv-1"]);
  const [requestIds, setRequestIds] = useState<string[]>(["inv-2"]);

  const inventory = useMemo(() => {
    return MOCK_TRADE_INVENTORY.filter((item) => {
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.game.toLowerCase().includes(query.toLowerCase());
      const matchesRarity = rarity === "ALL" || item.rarity === rarity;
      return matchesQuery && matchesRarity;
    });
  }, [query, rarity]);

  const offered = MOCK_TRADE_INVENTORY.filter((item) => offerIds.includes(item.id));
  const requested = MOCK_TRADE_INVENTORY.filter((item) => requestIds.includes(item.id));
  const rarityOk = sameRarityTier(offered, requested);

  function toggle(list: string[], id: string, setter: (next: string[]) => void) {
    setter(list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Trade</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Peer item swaps. Owner rule: only the same rarity tier may be traded. Ownership, rarity,
          and locks must be validated on the server before settle — this UI is presentation only.
        </p>
      </div>

      <Card>
        <CardTitle>Discovery</CardTitle>
        <CardDescription>Search available items and inspect eligibility.</CardDescription>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-muted">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3"
              placeholder="Title or game"
            />
          </label>
          <label className="text-sm sm:w-48">
            <span className="mb-1 block text-muted">Rarity</span>
            <select
              value={rarity}
              onChange={(event) => setRarity(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3"
            >
              <option value="ALL">All</option>
              {Object.entries(RARITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {inventory.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-surface-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted">
                    {item.game} · {item.platform} · {RARITY_LABEL[item.rarity]} · @
                    {item.ownerHandle}
                  </p>
                </div>
                <StatusPill tone={item.eligible && !item.locked ? "success" : "warning"}>
                  {item.locked ? "Locked" : item.eligible ? "Eligible" : "Blocked"}
                </StatusPill>
              </div>
              <p className="mt-2 text-xs text-muted">{item.eligibilityNote}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={offerIds.includes(item.id) ? "primary" : "secondary"}
                  onClick={() => toggle(offerIds, item.id, setOfferIds)}
                >
                  Offer
                </Button>
                <Button
                  size="sm"
                  variant={requestIds.includes(item.id) ? "primary" : "ghost"}
                  onClick={() => toggle(requestIds, item.id, setRequestIds)}
                >
                  Request
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Offer composer</CardTitle>
        <CardDescription>Compare sides before sending. Actions are UI stubs.</CardDescription>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-neon-mint">You offer</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {offered.length === 0 ? (
                <li className="text-muted">No items selected.</li>
              ) : (
                offered.map((item) => (
                  <li key={item.id}>
                    {item.title} · {RARITY_LABEL[item.rarity]}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neon-lime">You request</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {requested.length === 0 ? (
                <li className="text-muted">No items selected.</li>
              ) : (
                requested.map((item) => (
                  <li key={item.id}>
                    {item.title} · {RARITY_LABEL[item.rarity]}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm">
          Same-rarity rule:{" "}
          <StatusPill tone={rarityOk ? "success" : "danger"}>
            {rarityOk ? "Valid tier match" : "Invalid — tiers differ"}
          </StatusPill>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={!rarityOk}>
            Send offer
          </Button>
          <Button size="sm" variant="secondary">
            Counteroffer
          </Button>
          <Button size="sm" variant="ghost">
            Cancel
          </Button>
          <Button size="sm" variant="danger">
            Report
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Trade history</CardTitle>
        <CardDescription>Pending, completed, expired, and disputed states.</CardDescription>
        <ul className="mt-4 divide-y divide-border">
          {MOCK_TRADES.map((trade) => (
            <li
              key={trade.publicRef}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-mono text-xs text-neon-lime">{trade.publicRef}</p>
                <p className="text-sm">
                  @{trade.proposerHandle} → @{trade.counterpartyHandle}
                </p>
                <p className="text-xs text-muted">{trade.note ?? "No note"}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill
                  tone={
                    trade.state === "COMPLETED"
                      ? "success"
                      : trade.state === "DISPUTED" || !trade.sameRarityRuleOk
                        ? "danger"
                        : "warning"
                  }
                >
                  {tradeStateLabel(trade.state)}
                </StatusPill>
                <Link
                  href={`/trade/${trade.publicRef}`}
                  className="text-sm text-neon-mint hover:underline"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
