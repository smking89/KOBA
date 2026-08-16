import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Verification</CardTitle>
          <p className="mt-2 font-mono text-xl">{profile.verificationStatus}</p>
          <CardDescription>Staff verifies profiles. You cannot self-verify.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Active campaigns</CardTitle>
          <p className="mt-2 font-mono text-2xl">
            {participations.filter((row) => row.status === "ACTIVE").length}
          </p>
        </Card>
        <Card>
          <CardTitle>Available (not withdrawable)</CardTitle>
          <p className="mt-2 font-mono text-2xl">
            {totals[0] ? dollars(totals[0].available, totals[0].currency) : dollars(0)}
          </p>
        </Card>
      </div>
      <Card>
        <CardTitle>Legacy HANDLE-PRODUCT codes</CardTitle>
        <CardDescription>Existing shop promo codes remain supported.</CardDescription>
        <div className="mt-4">
          <InfluencerPayoutButton onboarded={dashboard.onboarded} />
        </div>
        <CreateReferralCodeForm />
        <ul className="mt-4 space-y-2">
          {dashboard.codes.map((code) => (
            <li key={code.publicRef} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{code.code}</span>
              <RevokeReferralButton code={code.code} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
