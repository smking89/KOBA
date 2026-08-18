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
import { activateProductSubscription } from "@/features/payments/services/subscription-checkout.service";
import {
  cancelProductSubscription,
  expireProductSubscriptionForFailedPayment,
  recordSubscriptionRenewalInvoice,
} from "@/features/payments/services/subscription-lifecycle.service";
import { subscriptionIdFromInvoice } from "@/features/plus/lib/stripe-map";

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

      if (session.metadata?.kind === "product_subscription") {
        const subscriptionRef = session.metadata?.subscriptionRef ?? session.client_reference_id;
        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null);
        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
        if (!subscriptionRef || !stripeSubscriptionId) return;
        await activateProductSubscription({
          publicRef: subscriptionRef,
          stripeSubscriptionId,
          stripeCustomerId,
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
    // ProductSubscription lifecycle (client, 2026-08-18: "Upon a
    // Stripe cancellation or failed payment webhook, the system must
    // auto-queue Expiry Commands") — Plus already claimed its own
    // subscription/invoice events above via handlePlusStripeEvent, so
    // by the time execution reaches here the event is either for a
    // ProductSubscription or belongs to neither and both handlers
    // below no-op on a missing row.
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await cancelProductSubscription(subscription.id);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const stripeSubscriptionId = subscriptionIdFromInvoice(invoice);
      if (!stripeSubscriptionId) return;
      await expireProductSubscriptionForFailedPayment(stripeSubscriptionId);
      return;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      if (invoice.billing_reason !== "subscription_cycle") {
        // The very first invoice (billing_reason "subscription_create")
        // is already handled by checkout.session.completed above.
        return;
      }
      await recordSubscriptionRenewalInvoice(invoice);
      return;
    }
    default:
      return;
  }
}
