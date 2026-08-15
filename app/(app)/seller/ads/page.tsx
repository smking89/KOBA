import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { listSellerAds } from "@/features/promotions/services/ads.service";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";
import { ActionButton, AdCreateForm } from "@/features/promotions/components/promotion-forms";

export const metadata = { title: "Sponsored ads" };

export default async function SellerAdsPage() {
  const { userId } = await requireSellerPromotions("/seller/ads");
  const campaigns = await listSellerAds(userId);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Sponsored placements</h1>
      <p className="text-sm text-muted">
        COST_PER_CLICK in KOBA Coins. Ads are labeled Sponsored. No behavioral targeting.
      </p>
      <SellerPromotionsNav current="/seller/ads" />
      <Card>
        <CardTitle>Create draft</CardTitle>
        <AdCreateForm />
      </Card>
      <ul className="space-y-3">
        {campaigns.map((row) => (
          <li key={row.id}>
            <Card>
              <CardTitle className="font-mono">{row.publicRef}</CardTitle>
              <CardDescription>
                <Badge>{row.status}</Badge> · spend {row.spendCoins.toString()} /{" "}
                {row.totalBudgetCoins.toString()} coins · {row.clickCount} clicks
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton
                  url={`/api/seller/ads/${row.id}`}
                  body={{ action: "submit" }}
                  label="Submit"
                />
                <ActionButton
                  url={`/api/seller/ads/${row.id}`}
                  body={{ action: "activate" }}
                  label="Activate"
                />
                <ActionButton
                  url={`/api/seller/ads/${row.id}`}
                  body={{ action: "pause" }}
                  label="Pause"
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
