import Link from "next/link";
import { AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";
import { LibraryAssetCard } from "@/features/aiden/components/library-asset-card";
import { listLibrary } from "@/features/aiden/services/aiden.service";
import { requireAidenPage } from "@/features/aiden/lib/require-business";
import { listCategories, listGames } from "@/features/marketplace/services/product.service";

export const metadata = { title: "Aiden library" };

export default async function AidenLibraryPage() {
  const { userId } = await requireAidenPage("/aiden/library");
  const [assets, games, categories] = await Promise.all([
    listLibrary(userId).catch(() => []),
    listGames(),
    listCategories(),
  ]);

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
              <LibraryAssetCard asset={asset} games={games} categories={categories} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
