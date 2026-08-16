import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { MarketFilters } from "@/features/marketplace/components/market-filters";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { MarketFeed } from "@/features/marketplace/components/market-feed";
import { parseMarketQuery } from "@/features/marketplace/schemas/market.schemas";
import {
  listCategories,
  listGames,
  listPublicProducts,
} from "@/features/marketplace/services/product.service";
import { cn } from "@/lib/utils";

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
  const feedView = (Array.isArray(params.view) ? params.view[0] : params.view) === "feed";

  const [games, categories, catalog] = await Promise.all([
    listGames(),
    listCategories(),
    listPublicProducts(query, session?.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="live">Marketplace</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Skins, kits, and maps</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Buy from verified sellers, bid on live auctions, or grab a free drop — every listing
            here has been reviewed before it&apos;s live. Own something? You can trade it too.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border text-sm">
          <Link
            href={viewHref(params, "grid")}
            className={cn("px-3 py-1.5", !feedView ? "bg-neon-lime text-background" : "text-muted")}
          >
            Grid
          </Link>
          <Link
            href={viewHref(params, "feed")}
            className={cn("px-3 py-1.5", feedView ? "bg-neon-lime text-background" : "text-muted")}
          >
            Feed
          </Link>
        </div>
      </div>

      {feedView ? null : <MarketFilters query={query} games={games} categories={categories} />}

      {feedView ? (
        <MarketFeed items={catalog.items} signedIn={signedIn} />
      ) : catalog.items.length === 0 ? (
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

      {!feedView && catalog.pageCount > 1 ? (
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

function viewHref(
  params: Record<string, string | string[] | undefined>,
  view: "grid" | "feed",
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view") continue;
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar) {
      search.set(key, scalar);
    }
  }
  if (view === "feed") {
    search.set("view", "feed");
  }
  const qs = search.toString();
  return qs ? `/market?${qs}` : "/market";
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
