import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { getSellerCampaign } from "@/features/promotions/services/campaign.service";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";
import { ActionButton, InviteForm } from "@/features/promotions/components/promotion-forms";

export const metadata = { title: "Campaign" };

export default async function SellerCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { userId } = await requireSellerPromotions("/seller/promotions");
  const { campaignId } = await params;
  const campaign = await getSellerCampaign(userId, campaignId).catch(() => null);
  if (!campaign) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{campaign.name}</h1>
        <Badge>{campaign.status}</Badge>
      </div>
      <SellerPromotionsNav current="/seller/promotions" />
      <Card>
        <CardTitle>Budget</CardTitle>
        <CardDescription>
          Remaining {campaign.remainingBudgetCents} of {campaign.totalBudgetCents} cents. Committed
          conversions {campaign.conversionCount}. Edits never change paid order snapshots.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton
            url={`/api/seller/promotions/${campaign.id}`}
            body={{ action: "submit" }}
            label="Submit for review"
          />
          <ActionButton
            url={`/api/seller/promotions/${campaign.id}`}
            body={{ action: "activate" }}
            label="Activate"
          />
          <ActionButton
            url={`/api/seller/promotions/${campaign.id}`}
            body={{ action: "pause" }}
            label="Pause"
          />
        </div>
      </Card>
      <Card>
        <CardTitle>Invite influencer</CardTitle>
        <InviteForm campaignId={campaign.id} />
        <ul className="mt-4 space-y-2">
          {campaign.participations.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {row.influencer.profile?.handle ?? "influencer"} · <Badge>{row.status}</Badge>
              </span>
              <span className="flex gap-2">
                <ActionButton
                  url={`/api/seller/participations/${row.id}`}
                  body={{ action: "accept" }}
                  label="Approve"
                />
                <ActionButton
                  url={`/api/seller/participations/${row.id}`}
                  body={{ action: "reject" }}
                  label="Reject"
                />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
