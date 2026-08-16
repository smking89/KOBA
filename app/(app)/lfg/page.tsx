import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listGames } from "@/features/marketplace/services/product.service";
import { parseLfgQuery } from "@/features/lfg/schemas/lfg.schemas";
import { listLfgPosts } from "@/features/lfg/services/lfg.service";
import { LfgFilters } from "@/features/lfg/components/lfg-filters";
import { LFG_MIC_LABEL, LFG_REGION_LABEL, LFG_SKILL_LABEL } from "@/features/lfg/lib/rules";
import { PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";

export const metadata = { title: "LFG" };

export default async function LfgPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseLfgQuery(params);
  const session = await auth();
  const [games, posts] = await Promise.all([listGames(), listLfgPosts(query, session?.user.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Looking for Group"
        title="Find teammates"
        description="Filter by game, platform, region, skill, mic, and availability. Authors accept requests until the roster fills or the post expires."
        actions={
          <Link href="/lfg/new" className={cn(buttonVariants())}>
            New post
          </Link>
        }
      />

      <LfgFilters query={query} games={games} />

      {posts.length === 0 ? (
        <EmptyState>No open parties match these filters.</EmptyState>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const fill = Math.round((post.slotsFilled / post.slotsTotal) * 100);
            const closed = post.status !== "OPEN";
            return (
              <Link key={post.publicRef} href={`/lfg/${post.publicRef}`}>
                <Card className={closed ? "opacity-60" : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle>
                      {post.game.name} — {post.title}
                    </CardTitle>
                    <Badge>{post.status}</Badge>
                  </div>
                  <CardDescription className="mt-2">{post.body}</CardDescription>
                  <p className="mt-3 text-xs text-muted">
                    {PLATFORM_LABEL[post.platform]} · {LFG_REGION_LABEL[post.region]} ·{" "}
                    {LFG_SKILL_LABEL[post.skillLevel]} · {LFG_MIC_LABEL[post.mic]} ·{" "}
                    {post.availability}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="h-2 w-36 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-neon-lime" style={{ width: `${fill}%` }} />
                    </div>
                    <span className="font-mono">
                      {post.slotsFilled}/{post.slotsTotal} slots filled
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
