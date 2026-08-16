import type { PlatformFunctionKey } from "@/lib/generated/prisma/client";

/**
 * TDLS trust-boundary slice 1: a superadmin-controlled kill switch per major
 * platform function. This registry is the human-readable half — label and
 * description for the admin UI — keyed by the same PlatformFunctionKey enum
 * Prisma uses, so adding a function is a schema migration (new enum value)
 * plus one entry here, never a bare string.
 */
export type PlatformFunctionDescriptor = {
  key: PlatformFunctionKey;
  label: string;
  description: string;
};

export const PLATFORM_FUNCTIONS: readonly PlatformFunctionDescriptor[] = [
  {
    key: "STRIPE_PAYMENTS",
    label: "Stripe payments",
    description: "Checkout, Connect payouts, and escrow release. Disabling blocks new charges.",
  },
  {
    key: "AIDEN_GENERATION",
    label: "Aiden generation (Vest/Graft/Terra)",
    description: "AI asset generation jobs. Disabling blocks new job submission.",
  },
  {
    key: "CLAUDE_DESCRIPTION_ASSIST",
    label: "AI product description assist",
    description: "Claude-generated listing descriptions in the seller product form.",
  },
  {
    key: "SOCIAL_POSTING",
    label: "Social posting",
    description: "New posts, stories, and comments. Existing content stays visible.",
  },
  {
    key: "MESSAGING",
    label: "Direct messaging",
    description: "New messages and conversations.",
  },
  {
    key: "TRADE",
    label: "Trade offers",
    description: "Creating, countering, and accepting trade offers.",
  },
  {
    key: "MARKETPLACE_CHECKOUT",
    label: "Marketplace checkout",
    description: "Buying fixed-price and auction listings.",
  },
  {
    key: "SERVER_RCON",
    label: "Server RCON",
    description: "Remote console commands to registered game servers.",
  },
  {
    key: "PLUS_SUBSCRIPTIONS",
    label: "KOBA Plus subscriptions",
    description: "New Plus checkouts. Existing subscriptions are unaffected.",
  },
] as const;

export function isKnownPlatformFunctionKey(value: string): value is PlatformFunctionKey {
  return PLATFORM_FUNCTIONS.some((fn) => fn.key === value);
}

/** Only SUPERADMIN may flip platform-wide kill switches — deliberately
 * narrower than the SA/AD pattern used for shop verification/refunds,
 * since this controls whether money-moving and API-cost functions run at
 * all, not a single transaction. */
export function canManagePlatformFunctions(actorAccountTypes: readonly string[]): boolean {
  return actorAccountTypes.includes("SUPERADMIN");
}
