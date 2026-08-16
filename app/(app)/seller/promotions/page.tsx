import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { listSellerCampaigns } from "@/features/promotions/services/campaign.service";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";

export const metadata = { title: "Seller promotions" };

export default async function SellerPromotionsPage() {
  const { userId } = await requireSellerPromotions("/seller/promotions");
  const campaigns = await listSellerCampaigns(userId);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Affiliate campaigns</h1>
      <SellerPromotionsNav current="/seller/promotions" />
      <ul className="grid gap-4">
        {campaigns.map((row) => (
          <li key={row.id}>
            <Card>
              <CardTitle>
                <Link href={`/seller/promotions/${row.id}`} className="hover:text-neon-lime">
                  {row.name}
                </Link>
              </CardTitle>
              <CardDescription>
                <Badge>{row.status}</Badge> · remaining {row.remainingBudgetCents} cents ·{" "}
                {row._count.participations} influencers
              </CardDescription>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
