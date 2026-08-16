import type { PlusSubscriptionState } from "@/features/plus/lib/types";

export const PLUS_TRIALS_ENABLED = process.env.KOBA_PLUS_TRIALS_ENABLED === "true";

/**
 * Conservative entitlement policy.
 * Trials are off unless KOBA_PLUS_TRIALS_ENABLED=true.
 * No payment-failure grace period is approved — PAST_DUE and UNPAID are not entitled.
 */
export function isEntitledState(
  state: PlusSubscriptionState,
  opts?: { cancelAtPeriodEnd?: boolean; currentPeriodEnd?: Date | string | null; now?: Date },
): boolean {
  const now = opts?.now ?? new Date();
  if (state === "ACTIVE") {
    if (opts?.cancelAtPeriodEnd && opts.currentPeriodEnd) {
      return new Date(opts.currentPeriodEnd).getTime() > now.getTime();
    }
    return true;
  }
  if (state === "TRIALING") {
    return PLUS_TRIALS_ENABLED;
  }
  return false;
}

export function evaluateCheckoutEligibility(
  existing: {
    state: PlusSubscriptionState;
    stripeSubscriptionId: string | null;
  } | null,
): "ok" | "duplicate" | "manage_billing" {
  if (!existing?.stripeSubscriptionId) return "ok";
  if (existing.state === "PAST_DUE" || existing.state === "UNPAID") return "manage_billing";
  if (existing.state === "ACTIVE" || existing.state === "TRIALING" || existing.state === "PAUSED") {
    return "duplicate";
  }
  return "ok";
}

export function displayState(
  state: PlusSubscriptionState,
  cancelAtPeriodEnd: boolean,
): PlusSubscriptionState | "CANCEL_AT_PERIOD_END" {
  if (state === "ACTIVE" && cancelAtPeriodEnd) return "CANCEL_AT_PERIOD_END";
  return state;
}
