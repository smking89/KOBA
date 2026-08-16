import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { prisma } from "@/lib/db";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";
import { campaignReferralPath } from "@/features/promotions/lib/refs";

export const metadata = { title: "Campaign details" };

export default async function InfluencerCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { snapshot } = await requireInfluencerDashboard("/influencer/campaigns");
  const { campaignId } = await params;
  const participation = await prisma.campaignParticipation.findFirst({
    where: { campaignId, influencerUserId: snapshot.userId },
    include: {
      campaign: {
        include: { products: { include: { product: { select: { title: true, slug: true } } } } },
      },
      promoCode: true,
    },
  });
  if (!participation) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{participation.campaign.name}</h1>
      <InfluencerPromotionsNav current="/influencer/campaigns" />
      <Card>
        <CardTitle>Status</CardTitle>
        <Badge>{participation.status}</Badge>
        <CardDescription className="mt-3 whitespace-pre-wrap">
          {participation.campaign.terms}
        </CardDescription>
      </Card>
      <Card>
        <CardTitle>Referral link</CardTitle>
        <p className="mt-2 font-mono text-sm break-all">
          {participation.status === "ACTIVE"
            ? campaignReferralPath(participation.referralToken)
            : "Available after you are accepted."}
        </p>
        {participation.promoCode ? (
          <p className="mt-2 text-sm">Assigned code: {participation.promoCode.code}</p>
        ) : null}
      </Card>
    </div>
  );
}
