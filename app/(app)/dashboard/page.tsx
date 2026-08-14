import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { countActiveBids } from "@/features/auctions/services/auction.service";
import { countJoinedGroups } from "@/features/groups/services/group.service";
import { ACCOUNT_TYPE_LABEL } from "@/features/koba-id/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Player dashboard" };

export default async function PlayerDashboardPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (snapshot.activeAccountType !== "PLAYER") {
    redirect("/enter");
  }

  const [activeBids, groupsJoined] = await Promise.all([
    countActiveBids(session.user.id),
    countJoinedGroups(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="live">Player mode</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Welcome back, {snapshot.displayName ?? "player"}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted">
          {snapshot.kobaId} · {ACCOUNT_TYPE_LABEL.PLAYER} mode
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Inventory value</CardTitle>
          <p className="mt-2 font-mono text-2xl">—</p>
          <CardDescription>Marketplace inventory lands in Phase 5.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Active bids</CardTitle>
          <p className="mt-2 font-mono text-2xl">{activeBids}</p>
          <CardDescription>Live auctions where you are the leading bid.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Groups joined</CardTitle>
          <p className="mt-2 font-mono text-2xl">{groupsJoined}</p>
          <CardDescription>Public and private groups you belong to.</CardDescription>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/u/${snapshot.handle}`} className={cn(buttonVariants({ variant: "primary" }))}>
          Your profile
        </Link>
        <Link href="/feed" className={cn(buttonVariants({ variant: "secondary" }))}>
          Feed
        </Link>
        <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
          Explore Market
        </Link>
        <Link href="/orders" className={cn(buttonVariants({ variant: "secondary" }))}>
          Orders
        </Link>
        <Link href="/groups" className={cn(buttonVariants({ variant: "secondary" }))}>
          Groups
        </Link>
        <Link href="/lfg" className={cn(buttonVariants({ variant: "secondary" }))}>
          Open LFG
        </Link>
        <Link href="/settings" className={cn(buttonVariants({ variant: "ghost" }))}>
          Switch mode
        </Link>
      </div>
    </div>
  );
}
