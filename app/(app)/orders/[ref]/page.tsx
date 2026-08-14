import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import { PaymentError } from "@/features/payments/lib/errors";
import { actorIsStaff } from "@/features/payments/lib/staff";
import { getOrderReceipt } from "@/features/payments/services/checkout.service";
import { PaymentConfirming } from "@/features/payments/components/payment-confirming";

export const metadata = { title: "Receipt" };

export default async function OrderReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    const { ref } = await params;
    redirect(`/login?callbackUrl=/orders/${ref}`);
  }

  const { ref } = await params;
  const staff = await actorIsStaff(session.user.id);

  try {
    const receipt = await getOrderReceipt(ref, session.user.id, staff);

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <Badge>{receipt.status}</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Receipt</h1>
          <p className="mt-1 font-mono text-sm text-muted">{receipt.publicRef}</p>
        </div>
        <PaymentConfirming active={receipt.confirming} />
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm">
            {receipt.shop.name}{" "}
            <Link href={`/shops/${receipt.shop.slug}`} className="text-neon-lime hover:underline">
              View shop
            </Link>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {receipt.items.map((item) => (
              <li key={item.title} className="flex justify-between">
                <span>
                  {item.title} × {item.quantity}
                </span>
                <span className="font-mono">
                  {formatPrice(item.unitPriceCents * item.quantity, receipt.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-medium">
            <span>Total</span>
            <span className="font-mono">{formatPrice(receipt.totalCents, receipt.currency)}</span>
          </p>
          {receipt.applicationFeeCents != null ? (
            <p className="mt-2 flex justify-between text-sm text-muted">
              <span>KOBA fee</span>
              <span className="font-mono">
                {formatPrice(receipt.applicationFeeCents, receipt.currency)}
              </span>
            </p>
          ) : null}
          {receipt.sellerPayoutCents != null ? (
            <p className="mt-1 flex justify-between text-sm text-muted">
              <span>Seller payout</span>
              <span className="font-mono">
                {formatPrice(receipt.sellerPayoutCents, receipt.currency)}
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
