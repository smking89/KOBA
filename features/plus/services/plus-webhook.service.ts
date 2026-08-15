import type Stripe from "stripe";
import { AuditAction } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { getStripe } from "@/features/payments/lib/stripe";
import { isPlusMetadata, subscriptionIdFromInvoice } from "@/features/plus/lib/stripe-map";
import {
  clearPlusCheckoutSession,
  syncSubscriptionFromStripe,
} from "@/features/plus/services/plus.service";
import { notifyPlusPaymentFailed } from "@/features/plus/services/plus-mail.service";
import { prisma } from "@/lib/db";

async function retrieveSubscription(id: string): Promise<Stripe.Subscription | null> {
  try {
    return await getStripe().subscriptions.retrieve(id);
  } catch {
    return null;
  }
}

async function localPlusBySubscriptionId(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  return prisma.plusSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
}

export async function handlePlusStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (!isPlusMetadata(session.metadata)) {
        return false;
      }
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      if (!subscriptionId) {
        return true;
      }
      const subscription = await retrieveSubscription(subscriptionId);
      if (subscription) {
        await syncSubscriptionFromStripe(subscription, {
          source: "webhook",
          eventId: event.id,
          eventCreated: event.created,
          checkoutSessionId: session.id,
        });
      }
      return true;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      if (!isPlusMetadata(session.metadata)) {
        return false;
      }
      await clearPlusCheckoutSession(session.id);
      return true;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const local = await localPlusBySubscriptionId(subscription.id);
      if (!local && !isPlusMetadata(subscription.metadata)) {
        return false;
      }
      await syncSubscriptionFromStripe(subscription, {
        source: "webhook",
        eventId: event.id,
        eventCreated: event.created,
      });
      return true;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      const local = await localPlusBySubscriptionId(subscriptionId);
      const invoiceMeta = (
        invoice as Stripe.Invoice & { subscription_details?: { metadata?: Stripe.Metadata } }
      ).subscription_details?.metadata;
      if (!local && !isPlusMetadata(invoice.metadata) && !isPlusMetadata(invoiceMeta)) {
        return false;
      }
      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        if (subscription) {
          const saved = await syncSubscriptionFromStripe(subscription, {
            source: "webhook",
            eventId: event.id,
            eventCreated: event.created,
          });
          if (event.type === "invoice.payment_failed" && saved) {
            await writeAuditLog({
              actorUserId: saved.userId,
              action: AuditAction.PLUS_PAYMENT_FAILED,
              targetType: "PlusSubscription",
              targetId: saved.publicRef,
              metadata: { publicRef: saved.publicRef, eventId: event.id },
            });
            await notifyPlusPaymentFailed(saved.userId, saved.publicRef);
          }
        }
      }
      return Boolean(local || isPlusMetadata(invoice.metadata) || isPlusMetadata(invoiceMeta));
    }
    default:
      return false;
  }
}
