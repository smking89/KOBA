import { prisma } from "@/lib/db";
import { giveKitToPlayer } from "@/features/servers/services/server.service";
import { PaymentError } from "@/features/payments/lib/errors";

const STATE_ERROR_MESSAGE: Record<string, string> = {
  UNSUPPORTED: "This server doesn't support RCON delivery (missing host/port/credentials).",
  AUTH_FAILED: "RCON authentication failed — check the server's stored RCON password.",
  TIMEOUT: "The server didn't respond in time.",
};

/**
 * Direct-RCON auto-delivery (client, 2026-08-18: "we need a system like
 * tip4serv" — the direct-RCON channel, confirmed via AskUserQuestion).
 * Called from markOrderPaid the instant a Stripe webhook confirms
 * payment — not a manual seller "fulfill" action, matching Tip4Serv's
 * own instant-delivery behavior. Fails soft: a delivery failure doesn't
 * block the order itself, it just leaves the order retryable
 * (POST /api/business/orders/[publicRef]/redeliver) with a clear reason
 * surfaced to the seller.
 */
export async function deliverRconKitForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: { select: { ownerUserId: true } },
      items: {
        include: { product: { select: { rconServerId: true, rconKitName: true } } },
      },
    },
  });
  if (!order || order.rconDeliveryStatus !== "PENDING") return;

  const product = order.items[0]?.product;
  if (!product?.rconServerId || !product.rconKitName || !order.buyerGameHandle) {
    // Shouldn't happen (createCheckoutSession already gates on these
    // being set together), but never leave a paid order stuck on
    // PENDING delivery status if it does.
    await prisma.order.update({
      where: { id: order.id },
      data: { rconDeliveryStatus: "NOT_APPLICABLE" },
    });
    return;
  }

  try {
    const { state } = await giveKitToPlayer(
      order.shop.ownerUserId,
      product.rconServerId,
      product.rconKitName,
      order.buyerGameHandle,
      null,
    );
    await prisma.order.update({
      where: { id: order.id },
      data:
        state === "SUCCESS"
          ? { rconDeliveryStatus: "DELIVERED", rconDeliveryError: null }
          : {
              rconDeliveryStatus: "FAILED",
              rconDeliveryError: STATE_ERROR_MESSAGE[state] ?? `Delivery failed (${state}).`,
            },
    });
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        rconDeliveryStatus: "FAILED",
        rconDeliveryError: error instanceof Error ? error.message : "Unknown delivery error.",
      },
    });
  }
}

/** Seller-triggered retry after a FAILED delivery — reuses the same
 * logic, just flips status back to PENDING first so
 * deliverRconKitForOrder's guard doesn't no-op. Same
 * shop-owner-only permission shape as fulfillOrder. */
export async function redeliverRconKitForOrder(actorUserId: string, publicRef: string) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: { shop: { select: { ownerUserId: true } } },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (order.shop.ownerUserId !== actorUserId) {
    throw new PaymentError("Only the shop owner can retry delivery.", "FORBIDDEN");
  }
  if (order.rconDeliveryStatus !== "FAILED") {
    throw new PaymentError("This order isn't in a failed-delivery state.", "CONFLICT");
  }

  await prisma.order.update({ where: { id: order.id }, data: { rconDeliveryStatus: "PENDING" } });
  await deliverRconKitForOrder(order.id);

  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}
