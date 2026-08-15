import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  expireCheckoutSession,
  markOrderPaid,
  markOrderRefunded,
} from "@/features/payments/services/checkout.service";
import {
  expireCoinPurchaseCheckout,
  markCoinPurchasePaid,
} from "@/features/wallet/services/coin-purchase.service";
import {
  markSubscriptionCancelled,
  syncSubscriptionFromStripe,
} from "@/features/plus/services/plus.service";

export { verifyStripeEvent } from "@/features/payments/lib/webhook-verify";

async function claimEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await prisma.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type },
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

      // Coin purchases, Plus subscriptions, and marketplace orders share
      // this same webhook event but are otherwise fully separate flows/
      // tables — routed by session.metadata.kind.
      if (session.metadata?.kind === "coin_purchase") {
        await markCoinPurchasePaid({ sessionId: session.id, paymentIntentId: paymentIntent });
        return;
      }
      if (session.metadata?.kind === "plus_subscription") {
        // No-op here: customer.subscription.created (below) is the real
        // source of truth for Plus state — it carries the actual Stripe
        // subscription status, current period end, and cancel flag,
        // none of which checkout.session.completed itself has.
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
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscriptionFromStripe(event.data.object);
      return;
    }
    case "customer.subscription.deleted": {
      await markSubscriptionCancelled(event.data.object);
      return;
    }
    // invoice.payment_failed is deliberately not handled separately —
    // Stripe already transitions the subscription itself to past_due on
    // a failed invoice, which fires customer.subscription.updated above
    // and lands the same PAST_DUE state via mapStripeStatus. A dedicated
    // handler here would just be a redundant second write.
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
    default:
      return;
  }
}
