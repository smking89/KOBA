import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  expireCheckoutSession,
  markOrderPaid,
  markOrderRefunded,
} from "@/features/payments/services/checkout.service";
import { handlePlusStripeEvent } from "@/features/plus/services/plus-webhook.service";
import { markCosmeticOrderPaid } from "@/features/koba-shop/services/cosmetic-checkout.service";
import {
  expireCoinPurchaseCheckout,
  markCoinPurchasePaid,
} from "@/features/wallet/services/coin-purchase.service";

export { verifyStripeEvent } from "@/features/payments/lib/webhook-verify";

async function claimEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await prisma.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type, eventCreated: event.created },
    });
    return true;
  } catch {
    return false;
  }
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const claimed = await claimEvent(event);
  if (!claimed) {
    return;
  }

  const plusHandled = await handlePlusStripeEvent(event);
  if (plusHandled) {
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "paid") {
        return;
      }
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      if (session.metadata?.kind === "coin_purchase") {
        await markCoinPurchasePaid({ sessionId: session.id, paymentIntentId: paymentIntent });
        return;
      }

      if (session.metadata?.kind === "cosmetic_order") {
        const cosmeticOrderRef = session.metadata?.cosmeticOrderRef ?? session.client_reference_id;
        if (!cosmeticOrderRef) return;
        await markCosmeticOrderPaid({
          publicRef: cosmeticOrderRef,
          paymentIntentId: paymentIntent,
          sessionId: session.id,
        });
        return;
      }

      const orderRef = session.metadata?.orderRef ?? session.client_reference_id;
      if (!orderRef) {
        return;
      }
      await markOrderPaid({
        publicRef: orderRef,
        paymentIntentId: paymentIntent,
        sessionId: session.id,
      });
      return;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      if (session.metadata?.kind === "coin_purchase") {
        await expireCoinPurchaseCheckout(session.id);
        return;
      }
      await expireCheckoutSession(session.id);
      return;
    }
    case "account.updated": {
      const account = event.data.object;
      await prisma.shop.updateMany({
        where: { stripeAccountId: account.id },
        data: {
          chargesEnabled: Boolean(account.charges_enabled),
          payoutsEnabled: Boolean(account.payouts_enabled),
        },
      });
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntent =
        typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (!paymentIntent) {
        return;
      }
      const order = await prisma.order.findFirst({
        where: { stripePaymentIntentId: paymentIntent },
      });
      if (order) {
        await markOrderRefunded(order.publicRef, null);
      }
      return;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object;
      const paymentIntent =
        typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
      if (!paymentIntent) {
        return;
      }
      const order = await prisma.order.findFirst({
        where: { stripePaymentIntentId: paymentIntent },
      });
      if (order) {
        await markOrderRefunded(order.publicRef, null);
      }
      return;
    }
    default:
      return;
  }
}
