import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PRODUCT_RARITIES, RARITY_LABEL } from "@/features/marketplace/lib/catalog";
import type { RarityDistribution } from "@/features/shops/services/analytics.service";

export function ShopRarityDistributionCard({ distribution }: { distribution: RarityDistribution }) {
  return (
    <Card>
      <CardTitle>Rarity distribution</CardTitle>
      <CardDescription>
        Share of your catalog by rarity tier, computed live from current listings.
      </CardDescription>

      <div className="mt-4 space-y-2">
        {PRODUCT_RARITIES.map((rarity) => (
          <div key={rarity} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs uppercase text-muted">
              {RARITY_LABEL[rarity]}
            </span>
            <div className="h-2 flex-1 rounded-full bg-surface-2">
              <div
                className="h-2 rounded-full bg-brand-gradient"
                style={{ width: `${distribution[rarity]}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs text-muted">
              {distribution[rarity]}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
