import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  MOCK_PLUS_SUBSCRIPTION,
  PLUS_BENEFITS,
  PLUS_MONTHLY_PRICE_LABEL,
  type PlusSubscriptionView,
} from "@/features/plus/lib/types";
import { PlusSubscriptionPanel } from "@/features/plus/components/plus-subscription-panel";
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
          {PLUS_MONTHLY_PRICE_LABEL}. Security, moderation, and accessibility stay free for
          everyone, always.
        </p>
      </div>

      <Card>
        <CardTitle>Your subscription</CardTitle>
        <CardDescription>
          {session?.user.id
            ? "Cancel takes effect at the end of your current billing period — you keep Plus perks through what you've already paid for."
            : "Sign in to subscribe."}
        </CardDescription>
        <div className="mt-4">
          {session?.user.id ? (
            <PlusSubscriptionPanel initial={subscription} />
          ) : (
            <p className="text-sm text-muted">Sign in first.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Free vs Plus</CardTitle>
        <CardDescription>What&apos;s live today vs. coming soon.</CardDescription>
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
    </div>
  );
}
