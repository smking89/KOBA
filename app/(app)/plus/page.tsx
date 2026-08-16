import Link from "next/link";
import { auth } from "@/lib/auth";
import { KobaBadgeArt } from "@/components/koba/koba-badge-art";
import { PageHeader } from "@/components/koba/page-header";
import { PlusMembershipPanel } from "@/features/plus/components/plus-membership-panel";
import { MOCK_PLUS_SUBSCRIPTION } from "@/features/plus/lib/types";
import { getPlanComparison, getSubscriptionStatus } from "@/features/plus/services/plus.service";

export const metadata = { title: "KOBA Plus" };

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const checkoutHint =
    params.checkout === "processing" || params.checkout === "cancelled" ? params.checkout : null;

  const [session, plans] = await Promise.all([auth(), getPlanComparison().catch(() => [])]);

  let subscription = MOCK_PLUS_SUBSCRIPTION;
  if (session?.user.id) {
    subscription = await getSubscriptionStatus(session.user.id).catch(() => MOCK_PLUS_SUBSCRIPTION);
  }
  if (checkoutHint === "processing") {
    subscription = { ...subscription, processing: true };
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="KOBA Plus"
        eyebrowTone="success"
        title={
          <span className="inline-flex items-center gap-3">
            <KobaBadgeArt mark="plus" size={40} />
            Optional membership
          </span>
        }
        description={
          <>
            KOBA Plus is optional and belongs to the active KOBA account. Security, moderation,
            accessibility, and account recovery stay free. Checkout uses Stripe test mode;
            membership activates only after a verified webhook.
            {!session?.user.id ? (
              <p className="mt-3 text-sm text-foreground">
                <Link href="/login?callbackUrl=/plus" className="text-neon-lime hover:underline">
                  Sign in
                </Link>{" "}
                to subscribe for this KOBAID.
              </p>
            ) : null}
          </>
        }
      />

      <PlusMembershipPanel
        initial={subscription}
        plans={plans}
        signedIn={Boolean(session?.user.id)}
        checkoutHint={checkoutHint}
      />
    </div>
  );
}
