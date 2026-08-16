import Link from "next/link";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
      <PageHeader
        eyebrow="Catalog"
        title="Apps and plugins"
        description="Third-party software is not guaranteed safe. KOBA does not execute uploaded code. Only published, staff-reviewed listings appear here."
      />
      <form
        className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-5"
        method="get"
      >
        <Input name="q" defaultValue={params.q} placeholder="Search" aria-label="Search apps" />
        <Input name="game" defaultValue={params.game} placeholder="Game" aria-label="Game" />
        <Input
          name="platform"
          defaultValue={params.platform}
          placeholder="Platform"
          aria-label="Platform"
        />
        <NativeSelect name="pricing" defaultValue={params.pricing ?? ""} aria-label="Pricing">
          <option value="">Any price</option>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </NativeSelect>
        <NativeSelect name="category" defaultValue={params.category ?? ""} aria-label="Category">
          <option value="">Any category</option>
          <option value="DISCORD_BOT">Discord bot</option>
          <option value="GAME_SERVER_PLUGIN">Game-server plugin</option>
          <option value="SERVER_MANAGEMENT">Server tool</option>
          <option value="INTEGRATION">Integration</option>
          <option value="DOWNLOADABLE_PACK">Asset pack</option>
          <option value="API_SERVICE">API service</option>
          <option value="UTILITY">Utility</option>
          <option value="THEME">Theme</option>
        </NativeSelect>
        <Button type="submit" className="md:col-span-5">
          Filter
        </Button>
      </form>
      {items.length === 0 ? (
        <EmptyState>No published apps match these filters.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.publicRef}>
              <Card className="flex h-full flex-col">
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
                <Link
                  href={`/apps/${item.slug}`}
                  className="mt-auto pt-3 text-sm font-semibold text-neon-lime hover:underline"
                >
                  Details →
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
