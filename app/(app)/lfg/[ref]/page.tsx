import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { LfgError } from "@/features/lfg/lib/errors";
import { getLfgPost } from "@/features/lfg/services/lfg.service";
import { LfgJoinButton } from "@/features/lfg/components/lfg-join-button";
import { LfgAuthorPanel } from "@/features/lfg/components/lfg-author-panel";
import { LFG_MIC_LABEL, LFG_REGION_LABEL, LFG_SKILL_LABEL } from "@/features/lfg/lib/rules";
import { PLATFORM_LABEL } from "@/features/marketplace/lib/catalog";

export const metadata = { title: "LFG post" };

export default async function LfgDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const session = await auth();

  try {
    const post = await getLfgPost(ref, session?.user.id);
    const fill = Math.round((post.slotsFilled / post.slotsTotal) * 100);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge>{post.status}</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{post.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {post.game.name} · {PLATFORM_LABEL[post.platform]} · {post.author.name}
              {post.author.kobaId ? (
                <span className="ml-2 font-mono text-xs">{post.author.kobaId}</span>
              ) : null}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">{post.body}</p>
          </div>
          <LfgJoinButton
            publicRef={post.publicRef}
            signedIn={Boolean(session?.user.id)}
            isAuthor={post.isAuthor}
            status={post.status}
            viewerRequest={post.viewerRequest}
          />
        </div>

        <Card>
          <CardTitle>Party</CardTitle>
          <CardDescription>
            {LFG_REGION_LABEL[post.region]} · {post.timezone} · {LFG_SKILL_LABEL[post.skillLevel]} ·{" "}
            {LFG_MIC_LABEL[post.mic]} · {post.availability}
          </CardDescription>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-neon-lime" style={{ width: `${fill}%` }} />
            </div>
            <span className="font-mono">
              {post.slotsFilled}/{post.slotsTotal} slots filled
            </span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Expires {new Date(post.expiresAt).toLocaleString()} · {post.publicRef}
          </p>
        </Card>

        {post.isAuthor ? (
          <LfgAuthorPanel publicRef={post.publicRef} requests={post.requests} />
        ) : null}

        <Link href="/lfg" className="text-sm text-neon-lime hover:underline">
          All LFG posts
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof LfgError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
