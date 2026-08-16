import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { prisma } from "@/lib/db";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";

export const metadata = { title: "Influencer analytics" };

export default async function InfluencerAnalyticsPage() {
  const { snapshot } = await requireInfluencerDashboard("/influencer/analytics");
  const [clicks, conversions, commissions] = await Promise.all([
    prisma.referralClickEvent.count({
      where: { participation: { influencerUserId: snapshot.userId } },
    }),
    prisma.promotionCommission.count({
      where: { influencerUserId: snapshot.userId, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.promotionCommission.findMany({
      where: { influencerUserId: snapshot.userId },
      select: { amountCents: true, status: true, currency: true },
    }),
  ]);
  const rate = clicks === 0 ? 0 : Math.floor((conversions * 10_000) / clicks);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
      <InfluencerPromotionsNav current="/influencer/analytics" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Clicks</CardTitle>
          <p className="mt-2 font-mono text-2xl">{clicks}</p>
        </Card>
        <Card>
          <CardTitle>Conversions</CardTitle>
          <p className="mt-2 font-mono text-2xl">{conversions}</p>
          <CardDescription>Paid attributed orders</CardDescription>
        </Card>
        <Card>
          <CardTitle>Conversion rate</CardTitle>
          <p className="mt-2 font-mono text-2xl">{(rate / 100).toFixed(2)}%</p>
          <CardDescription>
            Reproducible from stored events. Not estimated earnings.
          </CardDescription>
        </Card>
      </div>
      <Card>
        <CardTitle>Currency separation</CardTitle>
        <CardDescription>
          {commissions.length} commission rows. Totals stay in the order currency.
        </CardDescription>
      </Card>
    </div>
  );
}
