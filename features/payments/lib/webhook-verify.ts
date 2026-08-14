import Stripe from "stripe";
import { PaymentError } from "@/features/payments/lib/errors";
import { stripeWebhookSecret } from "@/features/payments/lib/stripe";

export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = stripeWebhookSecret();
  if (!secret) {
    throw new PaymentError("Stripe webhook secret is not configured.", "NOT_CONFIGURED");
  }
  if (!signature) {
    throw new PaymentError("Missing Stripe-Signature header.", "INVALID_SIGNATURE");
  }
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new PaymentError("Invalid Stripe webhook signature.", "INVALID_SIGNATURE");
  }
}
