import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { listInfluencerParticipations } from "@/features/promotions/services/participation.service";
import { listOpenCampaignsForInfluencer } from "@/features/promotions/services/campaign.service";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";
import { ActionButton } from "@/features/promotions/components/promotion-forms";

export const metadata = { title: "Influencer campaigns" };

export default async function InfluencerCampaignsPage() {
  const { snapshot } = await requireInfluencerDashboard("/influencer/campaigns");
  const [mine, open] = await Promise.all([
    listInfluencerParticipations(snapshot.userId),
    listOpenCampaignsForInfluencer(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
      <InfluencerPromotionsNav current="/influencer/campaigns" />
      <Card>
        <CardTitle>Your participation</CardTitle>
        <ul className="mt-3 space-y-3">
          {mine.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link
                  href={`/influencer/campaigns/${row.campaignId}`}
                  className="hover:text-neon-lime"
                >
                  {row.campaign.name}
                </Link>
                <p className="text-xs text-muted">
                  {row.campaign.shop.name} · <Badge>{row.status}</Badge>
                </p>
              </div>
              {row.status === "INVITED" ? (
                <ActionButton
                  url={`/api/influencer/participations/${row.id}`}
                  body={{ action: "accept", acceptTerms: true }}
                  label="Accept terms"
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Open campaigns</CardTitle>
        <CardDescription>Accept terms before promoting. Disclosure is required.</CardDescription>
        <ul className="mt-3 space-y-3">
          {open.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted">{row.shop.name}</p>
              </div>
              <ActionButton
                url={`/api/influencer/campaigns/${row.id}/apply`}
                body={{ action: "apply", acceptTerms: true }}
                label="Apply"
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
