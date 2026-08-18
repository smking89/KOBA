import { Search } from "lucide-react";
import { StoreAppCard } from "@/features/developers/components/store/store-app-card";
import { StoreCategoryTabs } from "@/features/developers/components/store/store-category-tabs";
import { searchPublicProducts } from "@/features/developers/services/developer.service";

export const metadata = { title: "App Store" };

export default async function AppsCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    game?: string;
    platform?: string;
    pricing?: string;
  }>;
}) {
  const params = await searchParams;
  const pricing =
    params.pricing === "FREE" || params.pricing === "PAID" ? params.pricing : undefined;

  const [popular, items] = await Promise.all([
    // "Popular" rail only makes sense on the unfiltered front page — real
    // download-count ranking, not editorial picks.
    !params.q && !params.category && !params.game && !params.platform && !pricing
      ? searchPublicProducts({ sort: "popular", take: 8 }).catch(() => [])
      : Promise.resolve([]),
    searchPublicProducts({
      ...(params.q ? { q: params.q } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.game ? { game: params.game } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(pricing ? { pricing } : {}),
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Bots, plugins &amp; tools
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          Third-party software is not guaranteed safe. Only published, staff-reviewed listings
          appear here.
        </p>
      </div>

      <form method="get" className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search apps, bots, and plugins"
          aria-label="Search apps"
          className="w-full rounded-full border border-border bg-surface py-3 pr-4 pl-11 text-sm text-foreground shadow-soft placeholder:text-muted focus:border-neon-lime focus:outline-none"
        />
      </form>

      <StoreCategoryTabs current={params.category} />

      {popular.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-foreground">Popular this week</h2>
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            {popular.map((app) => (
              <div key={app.publicRef} className="w-64 shrink-0">
                <StoreAppCard app={app} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">
          {params.q || params.category ? "Results" : "All apps"}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-12 text-center text-sm text-muted">
            No published apps match these filters.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((app) => (
              <StoreAppCard key={app.publicRef} app={app} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
