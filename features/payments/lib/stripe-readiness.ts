/**
 * Stripe readiness reporting — does not enable live charges.
 * Live keys remain rejected until an explicit future flip.
 */

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return value.includes("replace") || value.endsWith("_me") || value === "whsec_replace_me";
}

export type StripeReadiness = {
  configured: boolean;
  mode: "test" | "unset" | "live-blocked";
  webhookSecretPresent: boolean;
  allowLive: boolean;
  notes: string[];
};

export function getStripeReadiness(): StripeReadiness {
  const secret = process.env.STRIPE_SECRET_KEY;
  const allowLive = process.env.STRIPE_ALLOW_LIVE === "true";
  const webhookSecretPresent = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && !isPlaceholder(process.env.STRIPE_WEBHOOK_SECRET),
  );
  const notes: string[] = [];

  if (!secret || isPlaceholder(secret)) {
    notes.push("Set STRIPE_SECRET_KEY to a sk_test_ key for checkout.");
    return {
      configured: false,
      mode: "unset",
      webhookSecretPresent,
      allowLive,
      notes,
    };
  }

  if (secret.startsWith("sk_live_")) {
    notes.push(
      "Live secret keys are blocked. Checkout stays on sk_test_ until an explicit live-mode rollout.",
    );
    if (!allowLive) {
      notes.push("STRIPE_ALLOW_LIVE is not true — live mode remains disabled.");
    }
    return {
      configured: false,
      mode: "live-blocked",
      webhookSecretPresent,
      allowLive,
      notes,
    };
  }

  if (secret.startsWith("sk_test_")) {
    if (!webhookSecretPresent) {
      notes.push("Add STRIPE_WEBHOOK_SECRET and forward webhooks locally with stripe listen.");
    }
    notes.push("Test mode only. Paid status comes from signed webhooks.");
    return {
      configured: true,
      mode: "test",
      webhookSecretPresent,
      allowLive,
      notes,
    };
  }

  notes.push("Unrecognized STRIPE_SECRET_KEY prefix.");
  return {
    configured: false,
    mode: "unset",
    webhookSecretPresent,
    allowLive,
    notes,
  };
}
