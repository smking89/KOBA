import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { MarketFilters } from "@/features/marketplace/components/market-filters";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { parseMarketQuery } from "@/features/marketplace/schemas/market.schemas";
import {
  listCategories,
  listGames,
  listPublicProducts,
} from "@/features/marketplace/services/product.service";

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

  const [games, categories, catalog] = await Promise.all([
    listGames(),
    listCategories(),
    listPublicProducts(query, session?.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="live">Marketplace</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Trade what you build</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Skins, maps, monuments, kits, and cosmetics. Only approved listings appear here. Place
          bids on live auctions, then pay reserved wins through Stripe Checkout.
        </p>
      </div>

      <MarketFilters query={query} games={games} categories={categories} />

      {catalog.items.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          No approved listings match these filters. After migrating, seed a catalog with{" "}
          <code className="font-mono text-xs">pnpm db:seed</code>.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.items.map((product) => (
            <ProductCard key={product.slug} product={product} signedIn={signedIn} />
          ))}
        </div>
      )}

      {catalog.pageCount > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
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
