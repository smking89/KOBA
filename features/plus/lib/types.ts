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

export type PlusPlan = {
  id: string;
  interval: PlusPlanInterval;
  label: string;
  priceLabel: string;
  checkoutHandoff: string;
};

export type PlusSubscriptionView = {
  state: PlusSubscriptionState;
  planId: string | null;
  renewsAt: string | null;
  badgeVisible: boolean;
};

export const PLUS_BENEFITS: PlusBenefit[] = [
  { id: "browse", label: "Browse market, feed, groups, LFG", free: true, plus: true },
  { id: "trade", label: "Create trade offers", free: true, plus: true },
  {
    id: "aiden-quota",
    label: "Higher Aiden generation quota",
    free: false,
    plus: true,
    note: "Fair-use limits still apply.",
  },
  {
    id: "coins-bonus",
    label: "Periodic promotional KOBA Coins",
    free: false,
    plus: true,
  },
  {
    id: "badge",
    label: "KOBA Plus badge on profile",
    free: false,
    plus: true,
  },
  {
    id: "security",
    label: "Security, moderation, accessibility",
    free: true,
    plus: true,
    note: "Never paywalled.",
  },
];

export const PLUS_PLANS: PlusPlan[] = [
  {
    id: "plus-monthly",
    interval: "MONTHLY",
    label: "Monthly",
    priceLabel: "$7.99 / month",
    checkoutHandoff: "/plus?checkout=monthly",
  },
  {
    id: "plus-annual",
    interval: "ANNUAL",
    label: "Annual",
    priceLabel: "$71.88 / year",
    checkoutHandoff: "/plus?checkout=annual",
  },
];

export const MOCK_PLUS_SUBSCRIPTION: PlusSubscriptionView = {
  state: "NONE",
  planId: null,
  renewsAt: null,
  badgeVisible: false,
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
