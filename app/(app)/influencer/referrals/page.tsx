import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { listInfluencerParticipations } from "@/features/promotions/services/participation.service";
import { prisma } from "@/lib/db";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";
import { campaignReferralPath } from "@/features/promotions/lib/refs";

export const metadata = { title: "Referrals" };

export default async function InfluencerReferralsPage() {
  const { snapshot } = await requireInfluencerDashboard("/influencer/referrals");
  const participations = await listInfluencerParticipations(snapshot.userId);
  const clicks = await prisma.referralClickEvent.groupBy({
    by: ["participationId"],
    where: { participation: { influencerUserId: snapshot.userId } },
    _count: { _all: true },
  });
  const clickMap = new Map(clicks.map((row) => [row.participationId, row._count._all]));
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Referral links</h1>
      <InfluencerPromotionsNav current="/influencer/referrals" />
      {participations
        .filter((row) => row.status === "ACTIVE")
        .map((row) => (
          <Card key={row.id}>
            <CardTitle>{row.campaign.name}</CardTitle>
            <CardDescription>{clickMap.get(row.id) ?? 0} recorded clicks</CardDescription>
            <p className="mt-2 font-mono text-sm break-all">
              {campaignReferralPath(row.referralToken)}
            </p>
          </Card>
        ))}
    </div>
  );
}
