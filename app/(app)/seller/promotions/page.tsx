import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { listSellerCampaigns } from "@/features/promotions/services/campaign.service";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";
import {
  ListPanel,
  ListPanelEmpty,
  ListRowMain,
  ListRowMeta,
  ListRow,
} from "@/components/dashboard/list-panel";

export const metadata = { title: "Seller promotions" };

export default async function SellerPromotionsPage() {
  const { userId } = await requireSellerPromotions("/seller/promotions");
  const campaigns = await listSellerCampaigns(userId);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Affiliate campaigns</h1>
      <SellerPromotionsNav current="/seller/promotions" />
      {campaigns.length === 0 ? (
        <ListPanelEmpty>No affiliate campaigns yet.</ListPanelEmpty>
      ) : (
        <ListPanel>
          {campaigns.map((row) => (
            <ListRow key={row.id}>
              <ListRowMain>
                <Link
                  href={`/seller/promotions/${row.id}`}
                  className="font-medium text-foreground hover:text-neon-lime"
                >
                  {row.name}
                </Link>
                <ListRowMeta>
                  <Badge>{row.status}</Badge> · remaining {row.remainingBudgetCents} cents ·{" "}
                  {row._count.participations} influencers
                </ListRowMeta>
              </ListRowMain>
            </ListRow>
          ))}
        </ListPanel>
      )}
    </div>
  );
}
