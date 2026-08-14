import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { getMockTrade } from "@/features/trade/lib/catalog";
import { tradeStateLabel } from "@/features/trade/lib/types";
import { RARITY_LABEL } from "@/features/marketplace/lib/catalog";

export const metadata = { title: "Trade detail" };

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ tradeId: string }>;
}) {
  const { tradeId } = await params;
  const trade = getMockTrade(tradeId);
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
          <Badge tone="warning">Server validation required</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Offered</CardTitle>
          <CardDescription>Proposer side</CardDescription>
          <ul className="mt-3 space-y-2 text-sm">
            {trade.offered.map((item) => (
              <li key={item.id}>
                {item.title} · {RARITY_LABEL[item.rarity]} · {item.game}
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
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Actions</CardTitle>
        <CardDescription>UI stubs — no settlement in this phase.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm">Accept</Button>
          <Button size="sm" variant="secondary">
            Counter
          </Button>
          <Button size="sm" variant="ghost">
            Reject
          </Button>
          <Button size="sm" variant="ghost">
            Cancel
          </Button>
          <Button size="sm" variant="danger">
            Report
          </Button>
        </div>
      </Card>
    </div>
  );
}
