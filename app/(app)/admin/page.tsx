import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DisputedOrdersPanel } from "@/features/admin/components/disputed-orders-panel";
import { IssueStaffForm } from "@/features/admin/components/issue-staff-form";
import { PendingAidenPanel } from "@/features/admin/components/pending-aiden-panel";
import { PendingDeveloperProductsPanel } from "@/features/admin/components/pending-developer-products-panel";
import { PendingPromotionsPanel } from "@/features/admin/components/pending-promotions-panel";
import { PendingProductsPanel } from "@/features/admin/components/pending-products-panel";
import { PendingServersPanel } from "@/features/admin/components/pending-servers-panel";
import { PendingShopsPanel } from "@/features/admin/components/pending-shops-panel";
import { ReportsPanel } from "@/features/admin/components/reports-panel";
import { StaffRefundForm } from "@/features/admin/components/staff-refund-form";
import { PlusSubscriptionsPanel } from "@/features/admin/components/plus-subscriptions-panel";
import {
  canIssueStaffRole,
  canStaffApproveListing,
  canStaffModerateContent,
  canStaffRefund,
  canStaffVerifyShop,
  isAnyStaff,
} from "@/features/admin/lib/access";
import {
  getAdminOverview,
  listDisputedOrders,
  listOpenReports,
  listPendingAidenAssets,
  listPendingProducts,
  listPendingServers,
  listPendingShops,
} from "@/features/admin/services/admin.service";
import { listPendingDeveloperProducts } from "@/features/developers/services/moderation.service";
import { listStaffPromotionQueue } from "@/features/promotions/services/moderation.service";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { canManagePlatformFunctions } from "@/features/platform-control/lib/functions";
import { listPlatformFunctions } from "@/features/platform-control/services/platform-function.service";
import { PlatformFunctionsPanel } from "@/features/platform-control/components/platform-functions-panel";
import { canManagePlatformBlacklist } from "@/features/blacklist/lib/access";
import { listPlatformBlacklist } from "@/features/blacklist/services/platform-blacklist.service";
import { PlatformBlacklistPanel } from "@/features/blacklist/components/platform-blacklist-panel";
import { listPendingKobaShopApplications } from "@/features/koba-shop/services/application.service";
import { PendingKobaShopApplicationsPanel } from "@/features/koba-shop/components/pending-applications-panel";
import { auth } from "@/lib/auth";
import {
  challengePath,
  enrollmentPath,
  readElevationCookie,
} from "@/features/staff-mfa/lib/assurance";
import { userHasActiveStaffMfa } from "@/features/staff-mfa/lib/staff-user";
import { getActiveElevation } from "@/features/staff-mfa/services/staff-session.service";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

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

  const enrolled = await userHasActiveStaffMfa(session.user.id);
  if (!enrolled) {
    redirect(enrollmentPath());
  }
  const raw = await readElevationCookie();
  const elevation = raw ? await getActiveElevation(session.user.id, raw) : null;
  if (!elevation) {
    redirect(challengePath("/admin"));
  }

  const actorTypes = snapshot.identities.map((identity) => identity.accountType);
  const overview = await getAdminOverview(session.user.id);

  const [
    products,
    shops,
    reports,
    pendingServers,
    pendingAiden,
    pendingDev,
    promotions,
    disputedOrders,
  ] = await Promise.all([
    canStaffApproveListing(actorTypes) ? listPendingProducts(session.user.id) : Promise.resolve([]),
    canStaffVerifyShop(actorTypes) ? listPendingShops(session.user.id) : Promise.resolve([]),
    canStaffModerateContent(actorTypes) ? listOpenReports(session.user.id) : Promise.resolve([]),
    isAnyStaff(actorTypes) ? listPendingServers(session.user.id) : Promise.resolve([]),
    canStaffModerateContent(actorTypes)
      ? listPendingAidenAssets(session.user.id)
      : Promise.resolve([]),
    canStaffApproveListing(actorTypes) || canStaffModerateContent(actorTypes)
      ? listPendingDeveloperProducts(session.user.id).catch(() => [])
      : Promise.resolve([]),
    isAnyStaff(actorTypes)
      ? listStaffPromotionQueue().catch(() => ({
          campaigns: [],
          ads: [],
          influencers: [],
          commissions: [],
        }))
      : Promise.resolve({ campaigns: [], ads: [], influencers: [], commissions: [] }),
    canStaffRefund(actorTypes) ? listDisputedOrders(session.user.id) : Promise.resolve([]),
  ]);

  const canIssue =
    canIssueStaffRole(actorTypes, "MODERATOR") ||
    canIssueStaffRole(actorTypes, "ADMIN") ||
    canIssueStaffRole(actorTypes, "SUPERADMIN");

  const canManageFunctions = canManagePlatformFunctions(actorTypes);
  const platformFunctions = canManageFunctions ? await listPlatformFunctions() : [];

  const canManageBlacklist = canManagePlatformBlacklist(actorTypes);
  const platformBlacklist = canManageBlacklist
    ? await listPlatformBlacklist(session.user.id)
    : [];

  const pendingKobaShopApplications = canStaffVerifyShop(actorTypes)
    ? await listPendingKobaShopApplications(session.user.id)
    : [];

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
        <Card>
          <CardTitle className="text-2xl tabular-nums">
            {overview.counts.pendingAidenAssets}
          </CardTitle>
          <CardDescription>Aiden review queue</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">
            {overview.counts.pendingDevProducts}
          </CardTitle>
          <CardDescription>Developer product queue</CardDescription>
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
        <CardTitle>Server directory queue</CardTitle>
        <CardDescription>
          Approve or reject Business/Influencer server submissions (staff manual review).
        </CardDescription>
        <div className="mt-4">
          {isAnyStaff(actorTypes) ? (
            <PendingServersPanel servers={pendingServers} />
          ) : (
            <p className="text-sm text-muted">Staff only.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Aiden review queue</CardTitle>
        <CardDescription>
          Owner-submitted concept assets. Approval never publishes a listing or marks output as
          game-ready. Prompts stay private.
        </CardDescription>
        <div className="mt-4">
          {canStaffModerateContent(actorTypes) ? (
            <PendingAidenPanel assets={pendingAiden} />
          ) : (
            <p className="text-sm text-muted">Your staff role cannot moderate Aiden assets.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Developer marketplace queue</CardTitle>
        <CardDescription>
          Review publisher submissions. Approval does not execute uploaded code. Users cannot
          self-verify.
        </CardDescription>
        <div className="mt-4">
          {canStaffApproveListing(actorTypes) || canStaffModerateContent(actorTypes) ? (
            <PendingDeveloperProductsPanel
              products={pendingDev.map((product) => ({
                publicRef: product.publicRef,
                slug: product.slug,
                name: product.name,
                reviewState: product.reviewState,
                category: product.category,
                publisher: product.profile?.displayName ?? null,
                publisherSlug: product.profile?.slug ?? null,
                versions: product.versions.map((version) => ({
                  publicRef: version.publicRef,
                  semver: version.semver,
                  reviewState: version.reviewState,
                  artifacts: version.artifacts,
                })),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">Your staff role cannot review developer products.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Influencer promotions</CardTitle>
        <CardDescription>
          Verify creators, moderate affiliate campaigns and sponsored ads. Influencers cannot
          self-verify. Ad targeting is contextual only.
        </CardDescription>
        <div className="mt-4">
          {isAnyStaff(actorTypes) ? (
            <PendingPromotionsPanel queue={promotions} />
          ) : (
            <p className="text-sm text-muted">Staff access required.</p>
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
          Escrow holds a seller&apos;s payout until it auto-releases. Resolve buyer disputes here —
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

      {isAnyStaff(actorTypes) ? (
        <Card>
          <CardTitle>KOBA Plus subscriptions</CardTitle>
          <CardDescription>
            Search and reconcile from Stripe. Promotional access is a separate audited grant — never
            mark Active here.
          </CardDescription>
          <div className="mt-4">
            <PlusSubscriptionsPanel />
          </div>
        </Card>
      ) : null}

      {canManageFunctions ? (
        <Card>
          <CardTitle>Platform functions</CardTitle>
          <CardDescription>
            Superadmin-only kill switches for major platform functions. Disabling a function blocks
            it immediately across the platform (TDLS trust-boundary control, see docs/tdls.md).
          </CardDescription>
          <div className="mt-4">
            <PlatformFunctionsPanel
              initialFunctions={platformFunctions.map((fn) => ({
                ...fn,
                updatedAt: fn.updatedAt ? fn.updatedAt.toISOString() : null,
              }))}
            />
          </div>
        </Card>
      ) : null}

      {canManageBlacklist ? (
        <Card>
          <CardTitle>Platform blacklist</CardTitle>
          <CardDescription>
            Superadmin-only. Stricter than a shop&apos;s own blacklist — a USER ban is a full
            account lockout (can&apos;t sign in at all); a SHOP ban delists the storefront
            platform-wide.
          </CardDescription>
          <div className="mt-4">
            <PlatformBlacklistPanel
              initialEntries={platformBlacklist.map((entry) => ({
                ...entry,
                createdAt: entry.createdAt.toISOString(),
              }))}
            />
          </div>
        </Card>
      ) : null}

      {canStaffVerifyShop(actorTypes) ? (
        <Card>
          <CardTitle>KOBA Shop applications</CardTitle>
          <CardDescription>
            A second, narrower gate on top of Blue-Badge verification — approving here lets a
            shop&apos;s Cosmetic listings appear in the homepage-featured KOBA Shop.
          </CardDescription>
          <div className="mt-4">
            <PendingKobaShopApplicationsPanel applications={pendingKobaShopApplications} />
          </div>
        </Card>
      ) : null}

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
