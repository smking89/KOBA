import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { getConnectStatus } from "@/features/payments/services/connect.service";
import { ConnectOnboardButton } from "@/features/payments/components/connect-onboard-button";
import { PaymentError } from "@/features/payments/lib/errors";

export const metadata = { title: "Payouts" };

export default async function BusinessPayoutsPage() {
  const { userId } = await requireBusinessDashboard("/business/payouts");

  try {
    const status = await getConnectStatus(userId);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Payouts</h1>
          <p className="mt-1 text-sm text-muted">
            Stripe Connect (test mode) sends seller payouts after KOBA takes its platform fee.
            Charges never trust a browser “paid” flag.
          </p>
        </div>
        <Card>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>
            {status.configured
              ? "Use Stripe test accounts. Live keys are rejected by configuration."
              : "Add STRIPE_SECRET_KEY (sk_test_) and STRIPE_WEBHOOK_SECRET to enable checkout."}
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={status.chargesEnabled ? "success" : "warning"}>
              Charges {status.chargesEnabled ? "on" : "off"}
            </Badge>
            <Badge tone={status.payoutsEnabled ? "success" : "warning"}>
              Payouts {status.payoutsEnabled ? "on" : "off"}
            </Badge>
          </div>
          <div className="mt-4">
            <ConnectOnboardButton onboarded={status.onboarded} />
          </div>
        </Card>
        <Link href="/business" className={cn(buttonVariants({ variant: "ghost" }))}>
          Back to dashboard
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof PaymentError && error.code === "NOT_FOUND") {
      return (
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Payouts</h1>
          <p className="text-sm text-muted">Open a shop first.</p>
          <Link href="/business" className={cn(buttonVariants())}>
            Open shop
          </Link>
        </div>
      );
    }
    throw error;
  }
}
