import Link from "next/link";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RarityChip } from "@/features/marketplace/components/rarity-chip";
import { COSMETIC_SUB_TYPE_LABEL, formatPrice } from "@/features/marketplace/lib/catalog";
import { parseCosmeticQuery } from "@/features/marketplace/schemas/cosmetic.schemas";
import { listKobaShopCosmetics } from "@/features/koba-shop/services/catalog.service";

export const metadata = { title: "KOBA Shop" };

export default async function KobaShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseCosmeticQuery(params);
  const catalog = await listKobaShopCosmetics(query);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KOBA Shop"
        title="Cosmetics, curated"
        description="Nameplates, profile frames, avatar decorations, and more — sold only by shops KOBA has approved to sell here. Anyone can buy; equipping one needs KOBA Plus."
      />

      {catalog.items.length === 0 ? (
        <EmptyState>Nothing in the KOBA Shop yet — check back soon.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.items.map((cosmetic) => (
            <Link key={cosmetic.slug} href={`/koba-shop/${cosmetic.slug}`}>
              <Card className="h-full transition-colors hover:border-neon-lime/50">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{cosmetic.name}</CardTitle>
                  <RarityChip rarity={cosmetic.rarity} />
                </div>
                <CardDescription className="mb-2">
                  {COSMETIC_SUB_TYPE_LABEL[cosmetic.subType]} · {cosmetic.ownerShop.name}
                </CardDescription>
                <p className="font-mono text-lg">{formatPrice(cosmetic.priceCents, cosmetic.currency)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {catalog.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
          {query.page > 1 ? (
            <Link href={pageHref(params, query.page - 1)} className="text-neon-lime hover:underline">
              Previous
            </Link>
          ) : (
            <span className="text-muted">Previous</span>
          )}
          <span className="text-muted">
            Page {catalog.page} of {catalog.pageCount}
          </span>
          {query.page < catalog.pageCount ? (
            <Link href={pageHref(params, query.page + 1)} className="text-neon-lime hover:underline">
              Next
            </Link>
          ) : (
            <span className="text-muted">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar) search.set(key, scalar);
  }
  search.set("page", String(page));
  return `/koba-shop?${search.toString()}`;
}
