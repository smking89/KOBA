export const PLUS_PLAN_INTERVALS = ["MONTHLY", "ANNUAL"] as const;
export type PlusPlanInterval = (typeof PLUS_PLAN_INTERVALS)[number];

export const PLUS_SUBSCRIPTION_STATES = [
  "NONE",
  "INCOMPLETE",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "UNPAID",
  "PAUSED",
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
  comingLater?: boolean;
};

export type PlusPlan = {
  id: string;
  interval: PlusPlanInterval;
  label: string;
  priceLabel: string;
  checkoutHandoff: string;
};

export type PlusSubscriptionView = {
  publicRef: string | null;
  state: PlusSubscriptionState;
  displayState: PlusSubscriptionState | "CANCEL_AT_PERIOD_END";
  planCode: string | null;
  planId: string | null;
  interval: PlusPlanInterval | null;
  renewsAt: string | null;
  accessEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  badgeVisible: boolean;
  entitled: boolean;
  entitlements: string[];
  processing: boolean;
  accountType: string | null;
  hasBillingCustomer: boolean;
};

export const PLUS_BENEFITS: PlusBenefit[] = [
  { id: "browse", label: "Browse market, feed, groups, LFG", free: true, plus: true },
  { id: "trade", label: "Create trade offers", free: true, plus: true },
  {
    id: "security",
    label: "Security, moderation, accessibility, account recovery",
    free: true,
    plus: true,
    note: "Never paywalled.",
  },
  {
    id: "badge",
    label: "KOBA Plus badge on profile",
    free: false,
    plus: true,
  },
  {
    id: "aiden-quota",
    label: "Higher Aiden generation quota",
    free: false,
    plus: false,
    comingLater: true,
    note: "Coming later — not an approved benefit yet.",
  },
  {
    id: "coins-bonus",
    label: "Periodic promotional KOBA Coins",
    free: false,
    plus: false,
    comingLater: true,
    note: "Coming later — amount and refund policy are not approved.",
  },
];

export const PLUS_PLANS: PlusPlan[] = [
  {
    id: "KOBA_PLUS_MONTHLY",
    interval: "MONTHLY",
    label: "Monthly",
    priceLabel: "USD 7.99 / month",
    checkoutHandoff: "/plus?checkout=monthly",
  },
  {
    id: "KOBA_PLUS_ANNUAL",
    interval: "ANNUAL",
    label: "Annual",
    priceLabel: "USD 71.88 / year",
    checkoutHandoff: "/plus?checkout=annual",
  },
];

export const MOCK_PLUS_SUBSCRIPTION: PlusSubscriptionView = {
  publicRef: null,
  state: "NONE",
  displayState: "NONE",
  planCode: null,
  planId: null,
  interval: null,
  renewsAt: null,
  accessEndsAt: null,
  cancelAtPeriodEnd: false,
  badgeVisible: false,
  entitled: false,
  entitlements: [],
  processing: false,
  accountType: null,
  hasBillingCustomer: false,
};

export function plusStateLabel(state: PlusSubscriptionState | "CANCEL_AT_PERIOD_END"): string {
  switch (state) {
    case "NONE":
      return "Not subscribed";
    case "INCOMPLETE":
      return "Incomplete";
    case "TRIALING":
      return "Trialing";
    case "ACTIVE":
      return "Active";
    case "PAST_DUE":
      return "Past due";
    case "UNPAID":
      return "Unpaid";
    case "PAUSED":
      return "Paused";
    case "CANCEL_AT_PERIOD_END":
      return "Cancels at period end";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    default:
      return state;
  }
}
