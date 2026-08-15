import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireBusinessDashboard } from "@/features/shops/lib/require-business";
import { listShopOrders } from "@/features/shops/services/shop.service";
import { ShopError } from "@/features/shops/services/shop.service";
import { formatPrice } from "@/features/marketplace/lib/catalog";
import { OrderActionButton } from "@/features/payments/components/order-action-button";

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
            Paid status comes from signed Stripe webhooks. Fulfill after you deliver. Payouts are
            held in escrow on KOBA's balance and auto-release after the hold window unless the
            buyer reports a problem. Refunds after release reverse the Connect transfer and the
            platform fee.
          </p>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
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
                  <p className="text-xs text-muted">
                    {order.buyer.name ?? "Buyer"} · {order.kind} ·{" "}
                    {order.items
                      .map((item) => `${item.titleSnapshot} × ${item.quantity}`)
                      .join(", ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{order.status}</Badge>
                  {order.escrow ? (
                    <Badge
                      tone={
                        order.escrow.status === "DISPUTED"
                          ? "warning"
                          : order.escrow.status === "RELEASED"
                            ? "success"
                            : "default"
                      }
                    >
                      {order.escrow.status === "HOLDING"
                        ? `Escrow · releases ${order.escrow.releaseAt.toLocaleDateString()}`
                        : order.escrow.status === "DISPUTED"
                          ? "Escrow · disputed"
                          : order.escrow.status === "RELEASED"
                            ? "Escrow · released"
                            : "Escrow · refunded"}
                    </Badge>
                  ) : null}
                  <span className="font-mono text-sm">
                    {formatPrice(order.totalCents, order.currency)}
                  </span>
                  {order.status === "PAID" ? (
                    <OrderActionButton
                      publicRef={order.publicRef}
                      action="fulfill"
                      label="Fulfill"
                    />
                  ) : null}
                  {order.status === "PAID" || order.status === "FULFILLED" ? (
                    <OrderActionButton publicRef={order.publicRef} action="refund" label="Refund" />
                  ) : null}
                </div>
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
