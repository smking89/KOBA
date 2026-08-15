import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { PlusMembershipPanel } from "@/features/plus/components/plus-membership-panel";
import { MOCK_PLUS_SUBSCRIPTION } from "@/features/plus/lib/types";
import { getPlanComparison, getSubscriptionStatus } from "@/features/plus/services/plus.service";

export const metadata = { title: "KOBA Plus" };

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const checkoutHint =
    params.checkout === "processing" || params.checkout === "cancelled" ? params.checkout : null;

  let subscription = MOCK_PLUS_SUBSCRIPTION;
  if (session?.user.id) {
    subscription = await getSubscriptionStatus(session.user.id).catch(() => MOCK_PLUS_SUBSCRIPTION);
  }
  if (checkoutHint === "processing") {
    subscription = { ...subscription, processing: true };
  }

  const plans = await getPlanComparison().catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="success">KOBA Plus</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Optional membership</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          KOBA Plus is optional and belongs to the active KOBA account. Security, moderation,
          accessibility, and account recovery stay free. Checkout uses Stripe test mode; membership
          activates only after a verified webhook.
        </p>
        {!session?.user.id ? (
          <p className="mt-3 text-sm">
            <Link href="/login?callbackUrl=/plus" className="text-neon-lime hover:underline">
              Sign in
            </Link>{" "}
            to subscribe for this KOBAID.
          </p>
        ) : null}
      </div>

      <PlusMembershipPanel
        initial={subscription}
        plans={plans}
        signedIn={Boolean(session?.user.id)}
        checkoutHint={checkoutHint}
      />
    </div>
  );
}
