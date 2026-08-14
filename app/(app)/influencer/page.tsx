import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Influencer dashboard" };

export default async function InfluencerDashboardPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/influencer");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  if (snapshot.activeAccountType !== "INFLUENCER") {
    redirect("/enter");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="live">Influencer mode</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Promo & referrals</h1>
          <p className="mt-2 font-mono text-sm text-muted">{snapshot.kobaId}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Earnings · 30d</CardTitle>
          <p className="mt-2 font-mono text-2xl">—</p>
          <CardDescription>Influencer campaigns land in a later phase.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Referral sales</CardTitle>
          <p className="mt-2 font-mono text-2xl">0</p>
          <CardDescription>Codes are not live yet.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Payout status</CardTitle>
          <p className="mt-2 text-lg">Not connected</p>
          <CardDescription>Stripe Connect is Phase 8.</CardDescription>
        </Card>
      </div>

      <Link href="/settings" className={cn(buttonVariants({ variant: "secondary" }))}>
        Switch account mode
      </Link>
    </div>
  );
}
