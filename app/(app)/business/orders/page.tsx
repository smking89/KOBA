import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { listShopOrders } from "@/features/shops/services/shop.service";
import { ShopError } from "@/features/shops/services/shop.service";
import { formatPrice } from "@/features/marketplace/lib/catalog";

export const metadata = { title: "Orders" };

export default async function BusinessOrdersPage() {
  const { userId } = await requireBusinessDashboard("/business/orders");

  try {
    const orders = await listShopOrders(userId);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            Checkout and payments land in Phase 8. This inbox stays empty until then.
          </p>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between p-4 text-sm">
                <span>{order.buyer.name ?? "Buyer"}</span>
                <span className="font-mono">
                  {formatPrice(order.totalCents, order.currency)} · {order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/business" className={cn(buttonVariants({ variant: "ghost" }))}>
          Back to dashboard
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof ShopError && error.code === "NOT_FOUND") {
      return (
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
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
