import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { listSellerPromoCodes } from "@/features/promotions/services/promo-code.service";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";
import { ActionButton, PromoCodeForm } from "@/features/promotions/components/promotion-forms";

export const metadata = { title: "Promo codes" };

export default async function SellerPromoCodesPage() {
  const { userId } = await requireSellerPromotions("/seller/promo-codes");
  const codes = await listSellerPromoCodes(userId);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Promo codes</h1>
      <SellerPromotionsNav current="/seller/promo-codes" />
      <Card>
        <CardTitle>Create</CardTitle>
        <PromoCodeForm />
      </Card>
      <ul className="space-y-3">
        {codes.map((row) => (
          <li key={row.id}>
            <Card>
              <CardTitle className="font-mono">{row.code}</CardTitle>
              <CardDescription>
                <Badge>{row.active ? "active" : "suspended"}</Badge> · used {row.usageCount}
                {row.usageLimit != null ? `/${row.usageLimit}` : ""}
              </CardDescription>
              {row.active ? (
                <div className="mt-3">
                  <ActionButton
                    url={`/api/seller/promo-codes/${row.id}`}
                    body={{}}
                    label="Suspend"
                  />
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
