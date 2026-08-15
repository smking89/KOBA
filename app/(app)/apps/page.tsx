import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { searchPublicProducts } from "@/features/developers/services/developer.service";

export const metadata = { title: "App marketplace" };

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
  const items = await searchPublicProducts({
    ...(params.q ? { q: params.q } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.game ? { game: params.game } : {}),
    ...(params.platform ? { platform: params.platform } : {}),
    ...(pricing ? { pricing } : {}),
  }).catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Apps and plugins</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Third-party software is not guaranteed safe. KOBA does not execute uploaded code. Only
          published, staff-reviewed listings appear here.
        </p>
      </div>
      <form className="grid gap-3 md:grid-cols-5" method="get">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search"
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
        />
        <input
          name="game"
          defaultValue={params.game}
          placeholder="Game"
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
        />
        <input
          name="platform"
          defaultValue={params.platform}
          placeholder="Platform"
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
        />
        <select
          name="pricing"
          defaultValue={params.pricing ?? ""}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
        >
          <option value="">Any price</option>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </select>
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
        >
          <option value="">Any category</option>
          <option value="DISCORD_BOT">Discord bot</option>
          <option value="GAME_SERVER_PLUGIN">Game-server plugin</option>
          <option value="SERVER_MANAGEMENT">Server tool</option>
          <option value="INTEGRATION">Integration</option>
          <option value="DOWNLOADABLE_PACK">Asset pack</option>
          <option value="API_SERVICE">API service</option>
          <option value="UTILITY">Utility</option>
          <option value="THEME">Theme</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-neon-lime px-4 text-sm text-background md:col-span-5"
        >
          Filter
        </button>
      </form>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.publicRef}>
            <Card>
              <div className="flex flex-wrap gap-2">
                {item.kobaOfficial ? <Badge tone="success">KOBA official</Badge> : null}
                {item.verifiedPublisher ? (
                  <Badge>Verified</Badge>
                ) : (
                  <Badge tone="warning">Unverified</Badge>
                )}
              </div>
              <CardTitle className="mt-2">{item.name}</CardTitle>
              <CardDescription>
                {item.priceLabel} · {item.category}
              </CardDescription>
              <Link href={`/apps/${item.slug}`} className="mt-3 inline-flex text-sm text-neon-lime">
                Details
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
