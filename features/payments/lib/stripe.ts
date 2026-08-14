import Stripe from "stripe";
import { resolveCommissionBps, unverifiedCommissionBps } from "@/features/payments/lib/money";

function isPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  return value.includes("replace") || value.endsWith("_me") || value === "whsec_replace_me";
}

export function isStripeConfigured(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY;
  return Boolean(secret?.startsWith("sk_test_") && !isPlaceholder(secret));
}

export function stripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || isPlaceholder(secret)) {
    return null;
  }
  return secret;
}

/** Standard (unverified) take rate — prefer resolveCommissionBps for checkout. */
export function commissionBps(): number {
  return unverifiedCommissionBps();
}

export { resolveCommissionBps };

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe test mode is not configured.");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  return client;
}
