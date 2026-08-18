import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { COSMETIC_SUB_TYPE_LABEL, formatPrice } from "@/features/marketplace/lib/catalog";
import { getKobaShopCosmetic } from "@/features/koba-shop/services/catalog.service";
import { CosmeticCheckoutButton } from "@/features/koba-shop/components/cosmetic-checkout-button";

export default async function KobaShopCosmeticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cosmetic = await getKobaShopCosmetic(slug);
  if (!cosmetic) notFound();

  const session = await auth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-2xl">{cosmetic.name}</CardTitle>
          <RarityChip rarity={cosmetic.rarity} />
        </div>
        <CardDescription className="mb-4">
          {COSMETIC_SUB_TYPE_LABEL[cosmetic.subType]} · from{" "}
          <Link href={`/shops/${cosmetic.ownerShop.slug}`} className="text-neon-lime hover:underline">
            {cosmetic.ownerShop.name}
          </Link>
        </CardDescription>
        <p className="whitespace-pre-wrap text-sm text-muted">{cosmetic.description}</p>
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-mono text-2xl">{formatPrice(cosmetic.priceCents, cosmetic.currency)}</p>
          <CosmeticCheckoutButton slug={cosmetic.slug} signedIn={Boolean(session?.user.id)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Anyone can buy this. Equipping it on your profile needs an active KOBA Plus subscription —
          see <Link href="/plus" className="text-neon-lime hover:underline">KOBA Plus</Link>.
        </p>
      </Card>
    </div>
  );
}
