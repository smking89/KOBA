import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { COSMETIC_SUB_TYPE_LABEL, formatPrice, type CosmeticSubType, type ProductRarity } from "@/features/marketplace/lib/catalog";
import { cn } from "@/lib/utils";

export type KobaShopHeroCosmetic = {
  slug: string;
  name: string;
  subType: CosmeticSubType;
  rarity: ProductRarity;
  priceCents: number;
  currency: string;
  ownerShop: { name: string };
};

/** Homepage hero placement (client, 2026-08-15/18) — shown to every
 * visitor, no session-state personalization (confirmed via
 * AskUserQuestion), materially more exposure than a standard shop gets. */
export function KobaShopHeroSection({ cosmetics }: { cosmetics: KobaShopHeroCosmetic[] }) {
  if (cosmetics.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neon-lime uppercase">
          KOBA Shop
        </p>
        <Link href="/koba-shop" className="text-sm font-semibold text-neon-lime hover:underline">
          Browse all →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cosmetics.map((cosmetic) => (
          <Link key={cosmetic.slug} href={`/koba-shop/${cosmetic.slug}`}>
            <Card className="h-full transition-colors hover:border-neon-lime/50">
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{cosmetic.name}</CardTitle>
                <RarityChip rarity={cosmetic.rarity} />
              </div>
              <CardDescription className="mb-2">
                {COSMETIC_SUB_TYPE_LABEL[cosmetic.subType]} · {cosmetic.ownerShop.name}
              </CardDescription>
              <p className="font-mono">{formatPrice(cosmetic.priceCents, cosmetic.currency)}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Link href="/koba-shop" className={cn(buttonVariants({ variant: "secondary" }))}>
        Open KOBA Shop
      </Link>
    </section>
  );
}
