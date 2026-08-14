import type { GamePlatform, ProductRarity } from "@/features/marketplace/lib/catalog";

export const TRADE_STATES = [
  "DRAFT",
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "COMPLETED",
  "DISPUTED",
  "COUNTERED",
] as const;

export type TradeState = (typeof TRADE_STATES)[number];

export type TradeItemView = {
  id: string;
  title: string;
  game: string;
  platform: GamePlatform;
  rarity: ProductRarity;
  ownerHandle: string;
  owned: boolean;
  locked: boolean;
  eligible: boolean;
  eligibilityNote: string;
};

export type TradeOfferView = {
  publicRef: string;
  state: TradeState;
  createdAt: string;
  expiresAt: string | null;
  proposerHandle: string;
  counterpartyHandle: string;
  offered: TradeItemView[];
  requested: TradeItemView[];
  sameRarityRuleOk: boolean;
  note: string | null;
};

/** Owner rule: only items in the same rarity tier may be traded. Server must re-validate. */
export function sameRarityTier(
  offered: readonly { rarity: ProductRarity }[],
  requested: readonly { rarity: ProductRarity }[],
): boolean {
  if (offered.length === 0 || requested.length === 0) {
    return false;
  }
  const tiers = new Set([...offered, ...requested].map((item) => item.rarity));
  return tiers.size === 1;
}

export function tradeStateLabel(state: TradeState): string {
  switch (state) {
    case "DRAFT":
      return "Draft";
    case "PENDING":
      return "Pending";
    case "ACCEPTED":
      return "Accepted";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    case "COMPLETED":
      return "Completed";
    case "DISPUTED":
      return "Disputed";
    case "COUNTERED":
      return "Counteroffer";
    default:
      return state;
  }
}
