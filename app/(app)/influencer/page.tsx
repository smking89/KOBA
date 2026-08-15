import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireInfluencerDashboard } from "@/features/influencer/lib/require-influencer";
import { getInfluencerDashboard } from "@/features/influencer/services/influencer.service";
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
  const dashboard = await getInfluencerDashboard(snapshot.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="live">Influencer mode</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Promo & referrals</h1>
          <p className="mt-2 font-mono text-sm text-muted">{dashboard.kobaId}</p>
          <p className="mt-1 text-sm text-muted">
            Public page:{" "}
            <Link href={`/promo/${dashboard.handle}`} className="text-neon-mint hover:underline">
              /promo/{dashboard.handle}
            </Link>
          </p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "secondary" }))}>
          Switch account mode
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Clicks</CardTitle>
          <p className="mt-2 font-mono text-2xl">{dashboard.clicks}</p>
          <CardDescription>Referral link visits</CardDescription>
        </Card>
        <Card>
          <CardTitle>Attributed sales</CardTitle>
          <p className="mt-2 font-mono text-2xl">{dashboard.conversions}</p>
          <CardDescription>Paid orders using your code</CardDescription>
        </Card>
        <Card>
          <CardTitle>Earnings</CardTitle>
          <p className="mt-2 font-mono text-2xl">{dollars(dashboard.paidCents)}</p>
          <CardDescription>{dollars(dashboard.accruedCents)} accrued / payable</CardDescription>
        </Card>
      </div>

      <Card>
        <CardTitle>Payouts</CardTitle>
        <CardDescription>
          Stripe Connect (test mode) receives influencer transfers after an order is paid. Shop
          terms decide the cut. Live keys stay blocked.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={dashboard.payoutsEnabled ? "success" : "warning"}>
            Payouts {dashboard.payoutsEnabled ? "on" : "off"}
          </Badge>
          <Badge>{dashboard.onboarded ? "Account linked" : "Not connected"}</Badge>
        </div>
        <div className="mt-4">
          <InfluencerPayoutButton onboarded={dashboard.onboarded} />
        </div>
      </Card>

      <Card>
        <CardTitle>Create a code</CardTitle>
        <CardDescription>
          Format is HANDLE-PRODUCTSLUG. One active code per product. Shops must opt in first.
        </CardDescription>
        <div className="mt-4">
          <CreateReferralCodeForm />
        </div>
      </Card>

      <Card>
        <CardTitle>Your codes</CardTitle>
        {dashboard.codes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No referral codes yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {dashboard.codes.map((row) => (
              <li
                key={row.publicRef}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-sm text-neon-lime">{row.code}</p>
                  <p className="text-sm">
                    {row.productTitle} · {row.shopName}
                  </p>
                  <p className="text-xs text-muted">
                    {row.clickCount} clicks · {row.active ? "active" : "revoked"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={row.sharePath} className="text-sm text-neon-mint hover:underline">
                    Share link
                  </Link>
                  {row.active ? <RevokeReferralButton code={row.code} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Earnings history</CardTitle>
        {dashboard.earnings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No attributed earnings yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dashboard.earnings.map((row) => (
              <li
                key={row.publicRef}
                className="flex flex-col gap-1 border-b border-border/70 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-xs text-muted">{row.publicRef}</p>
                  <p className="text-sm">
                    {row.code} · order {row.orderRef}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{row.status}</Badge>
                  <span className="font-mono text-sm">
                    {dollars(row.amountCents, row.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
