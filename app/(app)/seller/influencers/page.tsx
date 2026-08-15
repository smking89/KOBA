import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { prisma } from "@/lib/db";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";

export const metadata = { title: "Campaign influencers" };

export default async function SellerInfluencersPage() {
  const { userId } = await requireSellerPromotions("/seller/influencers");
  const rows = await prisma.campaignParticipation.findMany({
    where: { campaign: { sellerUserId: userId } },
    include: {
      campaign: { select: { name: true } },
      influencer: { select: { profile: { select: { handle: true, displayName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Influencers</h1>
      <SellerPromotionsNav current="/seller/influencers" />
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Card>
              <CardTitle>
                {row.influencer.profile?.displayName ?? row.influencer.profile?.handle}
              </CardTitle>
              <CardDescription>
                {row.campaign.name} · <Badge>{row.status}</Badge>
              </CardDescription>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
