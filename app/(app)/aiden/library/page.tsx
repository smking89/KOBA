import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { MOCK_AIDEN_LIBRARY } from "@/features/aiden/lib/catalog";
import {
  AIDEN_DISCLAIMER,
  aidenAssetTypeLabel,
  aidenTechnicalLabel,
} from "@/features/aiden/lib/types";

export const metadata = { title: "Aiden library" };

export default function AidenLibraryPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/aiden" className="text-sm text-muted hover:text-foreground">
          ← Aiden
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Asset library</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {MOCK_AIDEN_LIBRARY.map((asset) => (
          <li key={asset.publicRef}>
            <Card className="h-full">
              <CardTitle>{asset.title}</CardTitle>
              <CardDescription>
                {asset.game} · {aidenAssetTypeLabel(asset.assetType)} · {asset.previewLabel}
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="accent">{aidenTechnicalLabel(asset.technicalStatus)}</StatusPill>
                <StatusPill>{asset.moderation}</StatusPill>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary">
                  Preview
                </Button>
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
    </div>
  );
}
