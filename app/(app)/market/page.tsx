import Link from "next/link";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { MarketFilters } from "@/features/marketplace/components/market-filters";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { parseMarketQuery } from "@/features/marketplace/schemas/market.schemas";
import {
  listCategories,
  listGames,
  listPublicProducts,
} from "@/features/marketplace/services/product.service";
import {
  pickSponsoredPlacement,
  resolveSponsoredCreative,
} from "@/features/promotions/services/ads.service";
import { SponsoredPlacementCard } from "@/features/promotions/components/sponsored-card";

export const metadata = { title: "Marketplace" };

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseMarketQuery(params);
  const session = await auth();
  const signedIn = Boolean(session?.user.id);

  const [games, categories, catalog, sponsored] = await Promise.all([
    listGames(),
    listCategories(),
    listPublicProducts(query, session?.user.id),
    pickSponsoredPlacement({
      placement: "MARKETPLACE",
      context: {
        gameId: query.game ?? null,
        categoryId: query.category ?? null,
      },
      viewerUserId: session?.user.id ?? null,
    }).catch(() => null),
  ]);
  const sponsoredCreative = sponsored
    ? await resolveSponsoredCreative(sponsored).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Trade what you build"
        description="Skins, maps, monuments, kits, and cosmetics. Only approved listings appear here. Place bids on live auctions, then pay reserved wins through Stripe Checkout."
      />

      <MarketFilters query={query} games={games} categories={categories} />

      {sponsored && sponsoredCreative ? (
        <SponsoredPlacementCard
          campaignId={sponsored.id}
          href={sponsoredCreative.href}
          title={sponsoredCreative.title}
          subtitle={sponsoredCreative.subtitle}
        />
      ) : null}

      {catalog.items.length === 0 ? (
        <EmptyState>
          No approved listings match these filters. After migrating, seed a catalog with{" "}
          <code className="font-mono text-xs text-foreground">pnpm db:seed</code>.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.items.map((product) => (
            <ProductCard key={product.slug} product={product} signedIn={signedIn} />
          ))}
        </div>
      )}

      {catalog.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
          {query.page > 1 ? (
            <Link
              href={pageHref(params, query.page - 1)}
              className="text-neon-lime hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span className="text-muted">Previous</span>
          )}
          <span className="text-muted">
            Page {catalog.page} of {catalog.pageCount}
          </span>
          {query.page < catalog.pageCount ? (
            <Link
              href={pageHref(params, query.page + 1)}
              className="text-neon-lime hover:underline"
            >
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
    if (scalar) {
      search.set(key, scalar);
    }
  }
  search.set("page", String(page));
  return `/market?${search.toString()}`;
}
