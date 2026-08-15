import Link from "next/link";
import { auth } from "@/lib/auth";
import { AidenLibraryCard } from "@/features/aiden/components/aiden-library-card";
import { AIDEN_DISCLAIMER } from "@/features/aiden/lib/types";
import { listLibrary } from "@/features/aiden/services/aiden.service";

export const metadata = { title: "Aiden library" };

export default async function AidenLibraryPage() {
  const session = await auth();
  const assets = session?.user.id ? await listLibrary(session.user.id).catch(() => []) : [];

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
              <AidenLibraryCard asset={asset} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
