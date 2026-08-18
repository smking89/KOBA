import { prisma } from "@/lib/db";
import { PaymentError } from "@/features/payments/lib/errors";
import { enqueueRconJob, executeRconJob } from "@/features/payments/services/rcon-queue.service";

/**
 * Direct-RCON auto-delivery (client, 2026-08-18: "we need a system like
 * tip4serv" — the direct-RCON channel, confirmed via AskUserQuestion).
 * Called from markOrderPaid the instant a Stripe webhook confirms
 * payment — not a manual seller "fulfill" action, matching Tip4Serv's
 * own instant-delivery behavior.
 *
 * Client, 2026-08-18 (KOBA-vs-Tip4Serv architecture spec): "the KOBA
 * gateway must cache the commands in a database queue and safely
 * retry execution using an exponential backoff strategy until success
 * is confirmed" for an offline/laggy target server. This function
 * creates the RconCommandJob and executes the first attempt inline —
 * the happy path (server online) still delivers instantly — but a
 * transient failure now hands off to rcon-queue.service's backoff
 * retry loop (scripts/run-rcon-delivery-worker.mjs) instead of going
 * straight to a terminal FAILED state that only a seller could fix.
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

  const job = await enqueueRconJob({
    orderId: order.id,
    serverId: product.rconServerId,
    kitName: product.rconKitName,
    gamertag: order.buyerGameHandle,
  });
  await executeRconJob(job.id);
}

/** Seller-triggered retry after a FAILED or DEAD delivery — creates a
 * fresh RconCommandJob (attempts reset to 0, a stale job's exhausted
 * backoff budget shouldn't carry over) and re-attempts inline, same
 * shop-owner-only permission shape as fulfillOrder. */
export async function redeliverRconKitForOrder(actorUserId: string, publicRef: string) {
  const order = await prisma.order.findUnique({
    where: { publicRef },
    include: {
      shop: { select: { ownerUserId: true } },
      items: { include: { product: { select: { rconServerId: true, rconKitName: true } } } },
    },
  });
  if (!order) {
    throw new PaymentError("Order not found.", "NOT_FOUND");
  }
  if (order.shop.ownerUserId !== actorUserId) {
    throw new PaymentError("Only the shop owner can retry delivery.", "FORBIDDEN");
  }
  if (order.rconDeliveryStatus !== "FAILED" && order.rconDeliveryStatus !== "DEAD") {
    throw new PaymentError("This order isn't in a failed-delivery state.", "CONFLICT");
  }

  const product = order.items[0]?.product;
  if (!product?.rconServerId || !product.rconKitName || !order.buyerGameHandle) {
    throw new PaymentError("This order has no RCON delivery configured.", "CONFLICT");
  }

  await prisma.order.update({ where: { id: order.id }, data: { rconDeliveryStatus: "PENDING" } });
  const job = await enqueueRconJob({
    orderId: order.id,
    serverId: product.rconServerId,
    kitName: product.rconKitName,
    gamertag: order.buyerGameHandle,
  });
  await executeRconJob(job.id);

  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}
