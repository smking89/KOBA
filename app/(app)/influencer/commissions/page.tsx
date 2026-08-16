import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import {
  listInfluencerCommissions,
  totalsByCurrency,
} from "@/features/promotions/services/commission.service";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";

export const metadata = { title: "Commissions" };

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function InfluencerCommissionsPage() {
  const { snapshot } = await requireInfluencerDashboard("/influencer/commissions");
  const commissions = await listInfluencerCommissions(snapshot.userId);
  const totals = totalsByCurrency(commissions);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Commissions</h1>
      <InfluencerPromotionsNav current="/influencer/commissions" />
      <p className="text-sm text-muted">
        Pending means the refund hold has not passed. Available is accrued on KOBA, not a bank
        payout. Fiat totals are never converted to KOBA Coins.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {totals.map((row) => (
          <Card key={row.currency}>
            <CardTitle>{row.currency}</CardTitle>
            <CardDescription>
              Pending {money(row.pending, row.currency)} · Available{" "}
              {money(row.available, row.currency)} · Reversed {money(row.reversed, row.currency)}
            </CardDescription>
          </Card>
        ))}
      </div>
      <ul className="space-y-3">
        {commissions.map((row) => (
          <li key={row.id}>
            <Card>
              <CardTitle className="flex items-center gap-2">
                {money(row.amountCents, row.currency)}
                <Badge>{row.status}</Badge>
              </CardTitle>
              <CardDescription>
                {row.campaign.name} · order {row.order.publicRef} · {row.attributionSource}
              </CardDescription>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
