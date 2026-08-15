export const PLUS_PLAN_INTERVALS = ["MONTHLY", "ANNUAL"] as const;
export type PlusPlanInterval = (typeof PLUS_PLAN_INTERVALS)[number];

export const PLUS_SUBSCRIPTION_STATES = [
  "NONE",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
] as const;

export type PlusSubscriptionState = (typeof PLUS_SUBSCRIPTION_STATES)[number];

export type PlusBenefit = {
  id: string;
  label: string;
  free: boolean;
  plus: boolean;
  note?: string;
};

/**
 * Single tier, $4.99/month (client-confirmed 2026-08-15) — no multiple
 * plans with different perk subsets. `ANNUAL` stays in
 * PLUS_PLAN_INTERVALS/PlusPlanInterval for schema compatibility but has
 * no offered plan below; add one later without a migration if wanted.
 */
export const PLUS_MONTHLY_PRICE_LABEL = "$4.99 / month";

export const PLUS_BENEFITS: PlusBenefit[] = [
  {
    id: "tenure-badge",
    label: "Profile badge that evolves with tenure",
    free: false,
    plus: true,
    note: "Bronze → Silver → Gold → Diamond as your subscription continues.",
  },
  {
    id: "server-bio",
    label: "Per-server bio",
    free: false,
    plus: true,
    note: "A different bio per game-server community, separate from your account bio.",
  },
  {
    id: "animated-media",
    label: "Animated avatar & profile banner",
    free: false,
    plus: false,
    note: "Coming soon — avatar/banner uploads don't exist yet for any account.",
  },
  {
    id: "themes",
    label: "Custom app themes, icons, notification sounds",
    free: false,
    plus: false,
    note: "Coming soon — no theming system exists yet.",
  },
  {
    id: "shop-discount",
    label: "Member discount on KOBA Shop cosmetics",
    free: false,
    plus: false,
    note: "Coming soon — blocked on the KOBA Shop itself (ROADMAP.md Phase 23).",
  },
  {
    id: "security",
    label: "Security, moderation, accessibility",
    free: true,
    plus: true,
    note: "Never paywalled.",
  },
];

export type PlusSubscriptionView = {
  state: PlusSubscriptionState;
  planId: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  badgeVisible: boolean;
  /** Null unless state is (or has ever been) ACTIVE. */
  tenureBadgeTier: string | null;
  tenureBadgeLabel: string | null;
};

export const MOCK_PLUS_SUBSCRIPTION: PlusSubscriptionView = {
  state: "NONE",
  planId: null,
  renewsAt: null,
  cancelAtPeriodEnd: false,
  badgeVisible: false,
  tenureBadgeTier: null,
  tenureBadgeLabel: null,
};

export function plusStateLabel(state: PlusSubscriptionState): string {
  switch (state) {
    case "NONE":
      return "Not subscribed";
    case "ACTIVE":
      return "Active";
    case "PAST_DUE":
      return "Past due";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    default:
      return state;
  }
}
