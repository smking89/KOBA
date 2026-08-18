import { redirect } from "next/navigation";
import Link from "next/link";
import { Gavel, Package, Users } from "lucide-react";
import { PageHeader } from "@/components/koba/page-header";
import { StatCard, StatCardGrid } from "@/components/dashboard/stat-card";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { countActiveBids } from "@/features/auctions/services/auction.service";
import { countJoinedGroups } from "@/features/groups/services/group.service";
import { getInventoryValueSummary } from "@/features/inventory/services/inventory.service";
import { formatPrice } from "@/features/marketplace/lib/catalog";
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

  const [inventoryValue, activeBids, groupsJoined] = await Promise.all([
    getInventoryValueSummary(session.user.id),
    countActiveBids(session.user.id),
    countJoinedGroups(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Player mode"
        title={`Welcome back, ${snapshot.displayName ?? "player"}`}
        description={
          <p className="font-mono text-sm">
            {snapshot.kobaId} · {ACCOUNT_TYPE_LABEL.PLAYER} mode
          </p>
        }
      />

      <StatCardGrid className="sm:grid-cols-3 lg:grid-cols-3">
        <StatCard
          label="Inventory value"
          value={formatPrice(inventoryValue.totalValueCents)}
          icon={Package}
          hint={`${inventoryValue.itemCount} item${inventoryValue.itemCount === 1 ? "" : "s"} in your inventory`}
        />
        <StatCard
          label="Active bids"
          value={activeBids}
          icon={Gavel}
          hint="Live auctions where you're the leading bid"
        />
        <StatCard
          label="Groups joined"
          value={groupsJoined}
          icon={Users}
          hint="Public and private groups you belong to"
        />
      </StatCardGrid>

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
