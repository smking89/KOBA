import Link from "next/link";
import { BadgeCheck, Megaphone, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatCard, StatCardGrid } from "@/components/dashboard/stat-card";
import { ListPanel, ListPanelEmpty, ListRow, ListRowActions } from "@/components/dashboard/list-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { getInfluencerDashboard } from "@/features/influencer/services/influencer.service";
import { getInfluencerProfile } from "@/features/promotions/services/profile.service";
import { listInfluencerParticipations } from "@/features/promotions/services/participation.service";
import {
  listInfluencerCommissions,
  totalsByCurrency,
} from "@/features/promotions/services/commission.service";
import { InfluencerPromotionsNav } from "@/features/promotions/components/influencer-promotions-nav";
import {
  CreateReferralCodeForm,
  InfluencerPayoutButton,
  RevokeReferralButton,
} from "@/features/influencer/components/influencer-forms";

export const metadata = { title: "Influencer dashboard" };

function dollars(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function InfluencerDashboardPage() {
  const { snapshot } = await requireInfluencerDashboard("/influencer");
  const [dashboard, profile, participations, commissions] = await Promise.all([
    getInfluencerDashboard(snapshot.userId),
    getInfluencerProfile(snapshot.userId),
    listInfluencerParticipations(snapshot.userId),
    listInfluencerCommissions(snapshot.userId),
  ]);
  const totals = totalsByCurrency(commissions);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="live">Influencer mode</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Promo & referrals</h1>
          <p className="mt-2 font-mono text-sm text-muted">{dashboard.kobaId}</p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "secondary" }))}>
          Switch account mode
        </Link>
      </div>
      <InfluencerPromotionsNav current="/influencer" />
      <p className="text-sm text-muted">
        Pending commissions are not guaranteed money. External payouts stay deferred unless a
        compliant Connect transfer already exists for legacy codes.
      </p>
      <StatCardGrid className="sm:grid-cols-3 lg:grid-cols-3">
        <StatCard
          label="Verification"
          value={profile.verificationStatus}
          icon={BadgeCheck}
          tone={profile.verificationStatus === "VERIFIED" ? "success" : "default"}
          hint="Staff verifies profiles — you cannot self-verify"
        />
        <StatCard
          label="Active campaigns"
          value={participations.filter((row) => row.status === "ACTIVE").length}
          icon={Megaphone}
        />
        <StatCard
          label="Available (not withdrawable)"
          value={totals[0] ? dollars(totals[0].available, totals[0].currency) : dollars(0)}
          icon={Wallet}
        />
      </StatCardGrid>
      <Card>
        <CardTitle>Legacy HANDLE-PRODUCT codes</CardTitle>
        <CardDescription>Existing shop promo codes remain supported.</CardDescription>
        <div className="mt-4">
          <InfluencerPayoutButton onboarded={dashboard.onboarded} />
        </div>
        <CreateReferralCodeForm />
        <div className="mt-4">
          {dashboard.codes.length === 0 ? (
            <ListPanelEmpty>No referral codes yet.</ListPanelEmpty>
          ) : (
            <ListPanel>
              {dashboard.codes.map((code) => (
                <ListRow key={code.publicRef}>
                  <span className="font-mono text-sm text-foreground">{code.code}</span>
                  <ListRowActions>
                    <RevokeReferralButton code={code.code} />
                  </ListRowActions>
                </ListRow>
              ))}
            </ListPanel>
          )}
        </div>
      </Card>
    </div>
  );
}
