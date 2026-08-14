import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listGames } from "@/features/marketplace/services/product.service";
import { CreateLfgForm } from "@/features/lfg/components/create-lfg-form";

export const metadata = { title: "New LFG post" };

export default async function NewLfgPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/lfg/new");
  }
  const games = await listGames();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Post Looking for Group</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Set game, platform, region, timezone, skill, mic, and when you play. You count as the
          first filled slot.
        </p>
      </div>
      <CreateLfgForm games={games} />
    </div>
  );
}
