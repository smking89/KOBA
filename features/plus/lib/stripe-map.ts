import type Stripe from "stripe";
import type { PlusSubscriptionState } from "@/features/plus/lib/types";

export function isPlusMetadata(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.kobaPlus === "1";
}

export function mapStripeSubscriptionStatus(status: string): PlusSubscriptionState {
  switch (status) {
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "EXPIRED";
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    case "canceled":
      return "CANCELLED";
    default:
      return "EXPIRED";
  }
}

export function shouldApplyStripeEvent(
  eventCreated: number | null | undefined,
  lastEventCreated: number | null | undefined,
): boolean {
  if (eventCreated == null) return true;
  if (lastEventCreated == null) return true;
  return eventCreated >= lastEventCreated;
}

export function unixToDate(value: number | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value * 1000);
}

export function periodFromStripeSubscription(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items?.data?.[0] as
    { current_period_start?: number; current_period_end?: number } | undefined;
  const legacy = subscription as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: unixToDate(item?.current_period_start ?? legacy.current_period_start),
    end: unixToDate(item?.current_period_end ?? legacy.current_period_end),
  };
}

export function priceIdFromStripeSubscription(subscription: Stripe.Subscription): string | null {
  const price = subscription.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    }
  ).subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

export const PLUS_SECRET_KEYS = [
  "client_secret",
  "payment_method",
  "card",
  "number",
  "cvc",
  "exp_month",
  "exp_year",
  "hosted_invoice_url",
  "invoice_pdf",
  "secret",
  "webhook_secret",
] as const;

export function assertNoPlusSecrets(value: unknown, path = "root"): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPlusSecrets(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (PLUS_SECRET_KEYS.some((secret) => lower === secret || lower.endsWith(`_${secret}`))) {
      throw new Error(`Refusing to expose Plus secret field: ${path}.${key}`);
    }
    assertNoPlusSecrets(nested, `${path}.${key}`);
  }
}

export function publicPlusIdentifiers(input: {
  publicRef?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  return {
    publicRef: input.publicRef ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
  };
}
