import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import { PaymentError } from "@/features/payments/lib/errors";
import { getSubscriptionReceipt } from "@/features/payments/services/subscription-checkout.service";
import { PaymentConfirming } from "@/features/payments/components/payment-confirming";

export const metadata = { title: "Subscription" };

const INTERVAL_LABEL: Record<string, string> = { MONTHLY: "month", ANNUAL: "year" };

export default async function SubscriptionReceiptPage({
  params,
}: {
  params: Promise<{ publicRef: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) {
    const { publicRef } = await params;
    redirect(`/login?callbackUrl=/orders/subscriptions/${publicRef}`);
  }

  const { publicRef } = await params;

  try {
    const receipt = await getSubscriptionReceipt(publicRef, session.user.id);

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <Badge>{receipt.status}</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Subscription</h1>
          <p className="mt-1 font-mono text-sm text-muted">{receipt.publicRef}</p>
        </div>
        <PaymentConfirming active={receipt.confirming} />
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm">
            {receipt.productTitle} ·{" "}
            <Link href={`/shops/${receipt.shop.slug}`} className="text-neon-lime hover:underline">
              {receipt.shop.name}
            </Link>
          </p>
          <p className="mt-4 flex justify-between font-medium">
            <span>Billed</span>
            <span className="font-mono">
              {formatPrice(receipt.priceCents, receipt.currency)} /{" "}
              {receipt.interval ? INTERVAL_LABEL[receipt.interval] : "period"}
            </span>
          </p>
          {receipt.currentPeriodEnd ? (
            <p className="mt-1 flex justify-between text-sm text-muted">
              <span>Renews</span>
              <span className="font-mono">
                {new Date(receipt.currentPeriodEnd).toLocaleDateString()}
              </span>
            </p>
          ) : null}
        </div>
        <Link href="/orders" className="text-sm text-neon-lime hover:underline">
          All orders
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof PaymentError && error.code === "NOT_FOUND") {
      notFound();
    }
    if (error instanceof PaymentError && error.code === "FORBIDDEN") {
      redirect("/orders");
    }
    throw error;
  }
}
