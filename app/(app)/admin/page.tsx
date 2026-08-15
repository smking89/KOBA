import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DisputedOrdersPanel } from "@/features/admin/components/disputed-orders-panel";
import { IssueStaffForm } from "@/features/admin/components/issue-staff-form";
import { PendingProductsPanel } from "@/features/admin/components/pending-products-panel";
import { PendingShopsPanel } from "@/features/admin/components/pending-shops-panel";
import { ReportsPanel } from "@/features/admin/components/reports-panel";
import { StaffRefundForm } from "@/features/admin/components/staff-refund-form";
import {
  canIssueStaffRole,
  canStaffApproveListing,
  canStaffModerateContent,
  canStaffRefund,
  canStaffVerifyShop,
} from "@/features/admin/lib/access";
import {
  getAdminOverview,
  listDisputedOrders,
  listOpenReports,
  listPendingProducts,
  listPendingShops,
} from "@/features/admin/services/admin.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { auth } from "@/lib/auth";

export const metadata = { title: "Staff" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot) {
    redirect("/login");
  }

  const staffIdentities = snapshot.identities.filter((identity) =>
    isStaffAccountType(identity.accountType),
  );

  if (staffIdentities.length === 0) {
    redirect("/enter");
  }

  const actorTypes = snapshot.identities.map((identity) => identity.accountType);
  const overview = await getAdminOverview(session.user.id);

  const [products, shops, reports, disputedOrders] = await Promise.all([
    canStaffApproveListing(actorTypes) ? listPendingProducts(session.user.id) : Promise.resolve([]),
    canStaffVerifyShop(actorTypes) ? listPendingShops(session.user.id) : Promise.resolve([]),
    canStaffModerateContent(actorTypes) ? listOpenReports(session.user.id) : Promise.resolve([]),
    canStaffRefund(actorTypes) ? listDisputedOrders(session.user.id) : Promise.resolve([]),
  ]);

  const canIssue =
    canIssueStaffRole(actorTypes, "MODERATOR") ||
    canIssueStaffRole(actorTypes, "ADMIN") ||
    canIssueStaffRole(actorTypes, "SUPERADMIN");

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="warning">Staff</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">KOBA staff</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Moderate listings, shops, and reports. Staff KOBAIDs never show badge icons — codes only.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 font-mono text-xs text-muted">
          {staffIdentities.map((identity) => (
            <li
              key={identity.code}
              className="rounded-md border border-border bg-surface px-2 py-1 text-foreground"
            >
              {identity.code}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle className="text-2xl tabular-nums">{overview.counts.pendingProducts}</CardTitle>
          <CardDescription>Pending listings</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{overview.counts.pendingShops}</CardTitle>
          <CardDescription>Pending shops</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{overview.counts.openReports}</CardTitle>
          <CardDescription>Open reports</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">
            {overview.counts.refundableOrders}
          </CardTitle>
          <CardDescription>Paid / fulfilled orders</CardDescription>
        </Card>
      </div>

      <Card>
        <CardTitle>Listing queue</CardTitle>
        <CardDescription>
          Approve or reject seller submissions. Sellers cannot self-approve.
        </CardDescription>
        <div className="mt-4">
          {canStaffApproveListing(actorTypes) ? (
            <PendingProductsPanel products={products} />
          ) : (
            <p className="text-sm text-muted">Your staff role cannot approve listings.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Shop verification</CardTitle>
        <CardDescription>
          Blue-badge style verification for Business shops (SA/AD only).
        </CardDescription>
        <div className="mt-4">
          {canStaffVerifyShop(actorTypes) ? (
            <PendingShopsPanel shops={shops} />
          ) : (
            <p className="text-sm text-muted">Moderators cannot verify shops.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Content reports</CardTitle>
        <CardDescription>Review, dismiss, or hide reported posts.</CardDescription>
        <div className="mt-4">
          {canStaffModerateContent(actorTypes) ? (
            <ReportsPanel reports={reports} />
          ) : (
            <p className="text-sm text-muted">Your staff role cannot moderate reports.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Disputed orders</CardTitle>
        <CardDescription>
          Escrow holds a seller's payout until it auto-releases. Resolve buyer disputes here —
          release to the seller or refund the buyer (SA/AD).
        </CardDescription>
        <div className="mt-4">
          <DisputedOrdersPanel orders={disputedOrders} canResolve={canStaffRefund(actorTypes)} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Issue staff KOBAID</CardTitle>
          <CardDescription>SA issues SA/AD/MD. AD issues MD only.</CardDescription>
          <div className="mt-4">
            <IssueStaffForm canIssue={canIssue} />
          </div>
        </Card>
        <Card>
          <CardTitle>Staff refund</CardTitle>
          <CardDescription>Refund a paid or fulfilled order by public ref (SA/AD).</CardDescription>
          <div className="mt-4">
            <StaffRefundForm canRefund={canStaffRefund(actorTypes)} />
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Recent audit</CardTitle>
        <CardDescription>Latest staff-relevant and platform actions.</CardDescription>
        <ul className="mt-4 space-y-2 font-mono text-xs text-muted">
          {overview.recentAudit.length === 0 ? (
            <li>No audit entries yet.</li>
          ) : (
            overview.recentAudit.map((entry) => (
              <li key={entry.id} className="border-b border-border/60 pb-2 last:border-0">
                <span className="text-foreground">{entry.action}</span>
                {entry.targetType ? ` · ${entry.targetType}` : ""}
                {entry.targetId ? ` · ${entry.targetId.slice(0, 12)}` : ""}
                <span className="ml-2 text-muted">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
