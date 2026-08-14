import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { cn } from "@/lib/utils";
import {
  MOCK_PLUS_SUBSCRIPTION,
  PLUS_BENEFITS,
  PLUS_PLANS,
  plusStateLabel,
  type PlusSubscriptionView,
} from "@/features/plus/lib/types";
import { getSubscription } from "@/features/plus/services/plus.service";

export const metadata = { title: "KOBA Plus" };

export default async function PlusPage() {
  const session = await auth();
  let subscription: PlusSubscriptionView = MOCK_PLUS_SUBSCRIPTION;
  if (session?.user.id) {
    subscription = await getSubscription(session.user.id).catch(() => MOCK_PLUS_SUBSCRIPTION);
  }

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="success">KOBA Plus</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Upgrade when it helps you create
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Plus is configuration-driven. Security, moderation, and accessibility stay free for
          everyone. Checkout is a handoff stub — no charges in this phase.
        </p>
        <div className="mt-3">
          <StatusPill tone="neutral">{plusStateLabel(subscription.state)}</StatusPill>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PLUS_PLANS.map((plan) => (
          <Card key={plan.id}>
            <CardTitle>{plan.label}</CardTitle>
            <CardDescription>{plan.priceLabel}</CardDescription>
            <Link
              href={plan.checkoutHandoff}
              className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
            >
              Continue to checkout
            </Link>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Free vs Plus</CardTitle>
        <CardDescription>Benefits matrix (config-driven).</CardDescription>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Benefit</th>
                <th className="py-2 pr-4 font-medium">Free</th>
                <th className="py-2 font-medium">Plus</th>
              </tr>
            </thead>
            <tbody>
              {PLUS_BENEFITS.map((benefit) => (
                <tr key={benefit.id} className="border-b border-border/70">
                  <td className="py-3 pr-4">
                    <div>{benefit.label}</div>
                    {benefit.note ? <div className="text-xs text-muted">{benefit.note}</div> : null}
                  </td>
                  <td className="py-3 pr-4">{benefit.free ? "Yes" : "—"}</td>
                  <td className="py-3">{benefit.plus ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Subscription controls</CardTitle>
        <CardDescription>
          Plan: {subscription.planId ?? "none"}
          {subscription.renewsAt ? ` · Renews ${subscription.renewsAt}` : ""}
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          >
            Renew
          </button>
          <button type="button" className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}>
            Cancel
          </button>
          {subscription.badgeVisible ? (
            <StatusPill tone="accent">Plus badge preview</StatusPill>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
