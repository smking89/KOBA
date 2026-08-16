import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import { listBuyerOrders } from "@/features/payments/services/checkout.service";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Orders" };

export default async function BuyerOrdersPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=/orders");
  }

  const orders = await listBuyerOrders(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Purchases"
        title="Your orders"
        description="Receipts stay on KOBA. Payment status comes from Stripe, not the browser."
      />
      {orders.length === 0 ? (
        <EmptyState>No orders yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {orders.map((order) => (
            <li
              key={order.publicRef}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <Link
                  href={`/orders/${order.publicRef}`}
                  className="font-mono text-sm hover:text-neon-lime"
                >
                  {order.publicRef}
                </Link>
                <p className="text-xs text-muted">{order.shop.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{order.status}</Badge>
                <span className="font-mono text-sm">
                  {formatPrice(order.totalCents, order.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
