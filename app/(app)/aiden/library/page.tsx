import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { cn } from "@/lib/utils";
import {
  AIDEN_DISCLAIMER,
  aidenAssetTypeLabel,
  aidenTechnicalLabel,
} from "@/features/aiden/lib/types";
import { listLibrary } from "@/features/aiden/services/aiden.service";
import { requireAidenPage } from "@/features/aiden/lib/require-business";

export const metadata = { title: "Aiden library" };

export default async function AidenLibraryPage() {
  const { userId } = await requireAidenPage("/aiden/library");
  const assets = await listLibrary(userId).catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/aiden" className="text-sm text-muted hover:text-foreground">
          ← Aiden
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Asset library</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-muted">No assets in your library yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {assets.map((asset) => (
            <li key={asset.publicRef}>
              <Card className="h-full">
                <CardTitle>{asset.title}</CardTitle>
                <CardDescription>
                  {asset.game} · {aidenAssetTypeLabel(asset.assetType)} · {asset.previewLabel}
                </CardDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill tone="accent">
                    {aidenTechnicalLabel(asset.technicalStatus)}
                  </StatusPill>
                  <StatusPill>{asset.moderation}</StatusPill>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {asset.assetUrl ? (
                    <a
                      href={asset.assetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
                    >
                      Preview
                    </a>
                  ) : (
                    <Button size="sm" variant="secondary" disabled>
                      Preview
                    </Button>
                  )}
                  <Button size="sm" disabled={asset.technicalStatus === "CONCEPT_ONLY"}>
                    Publish to shop
                  </Button>
                </div>
                {asset.technicalStatus === "CONCEPT_ONLY" ? (
                  <p className="mt-2 text-xs text-muted">
                    Concept-only assets cannot publish as game-ready listings.
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
