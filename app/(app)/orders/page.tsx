import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your orders</h1>
        <p className="mt-1 text-sm text-muted">
          Receipts stay on KOBA. Payment status comes from Stripe, not the browser.
        </p>
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-t-2 border-t-neon-lime border-border">
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
