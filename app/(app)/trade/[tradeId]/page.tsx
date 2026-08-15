import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { TradeActions } from "@/features/trade/components/trade-actions";
import { getMockTrade } from "@/features/trade/lib/catalog";
import { RARITY_VALUE_WARNING, tradeStateLabel } from "@/features/trade/lib/types";
import { getTradeByRef } from "@/features/trade/services/trade.service";
import { RARITY_LABEL } from "@/features/marketplace/lib/catalog";

export const metadata = { title: "Trade detail" };

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ tradeId: string }>;
}) {
  const { tradeId } = await params;
  const session = await auth();
  let trade = session?.user.id
    ? await getTradeByRef(session.user.id, tradeId).catch(() => null)
    : null;
  trade ??= getMockTrade(tradeId) ?? null;
  if (!trade) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trade" className="text-sm text-muted hover:text-foreground">
          ← Trade
        </Link>
        <h1 className="mt-2 font-mono text-2xl text-neon-lime">{trade.publicRef}</h1>
        <p className="mt-1 text-sm text-muted">
          @{trade.proposerHandle} ↔ @{trade.counterpartyHandle}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill tone="accent">{tradeStateLabel(trade.state)}</StatusPill>
          <StatusPill tone={trade.sameRarityRuleOk ? "success" : "danger"}>
            {trade.sameRarityRuleOk ? "Same rarity" : "Rarity mismatch"}
          </StatusPill>
          <Badge tone="warning">{trade.rarityTier}</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          {trade.valueWarning || RARITY_VALUE_WARNING}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Offered</CardTitle>
          <CardDescription>Proposer side</CardDescription>
          <ul className="mt-3 space-y-2 text-sm">
            {trade.offered.map((item) => (
              <li key={item.id}>
                {item.title} · {RARITY_LABEL[item.rarity]} · {item.game}
                {item.inventoryPublicRef ? (
                  <span className="ml-2 font-mono text-[10px] text-muted">
                    {item.inventoryPublicRef}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Requested</CardTitle>
          <CardDescription>Counterparty side</CardDescription>
          <ul className="mt-3 space-y-2 text-sm">
            {trade.requested.map((item) => (
              <li key={item.id}>
                {item.title} · {RARITY_LABEL[item.rarity]} · {item.game}
                {item.inventoryPublicRef ? (
                  <span className="ml-2 font-mono text-[10px] text-muted">
                    {item.inventoryPublicRef}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Accept, reject, or cancel via the trading API.</CardDescription>
        <div className="mt-4">
          <TradeActions trade={trade} />
        </div>
      </Card>
    </div>
  );
}
