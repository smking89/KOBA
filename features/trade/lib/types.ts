import type { GamePlatform, ProductRarity } from "@/features/marketplace/lib/catalog";
import { assertSameRarityTrade, RARITY_VALUE_WARNING } from "@/features/trade/lib/rarity-policy";

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
  "VOIDED",
] as const;

export type TradeState = (typeof TRADE_STATES)[number];

export type TradeItemView = {
  id: string;
  inventoryPublicRef: string | null;
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
  rarityTier: ProductRarity;
  createdAt: string;
  expiresAt: string | null;
  proposerHandle: string;
  counterpartyHandle: string;
  offered: TradeItemView[];
  requested: TradeItemView[];
  sameRarityRuleOk: boolean;
  note: string | null;
  parentPublicRef: string | null;
  valueWarning: string;
  viewerRole: "proposer" | "counterparty" | null;
};

export { RARITY_VALUE_WARNING };

/** UI/helper: true when all items share one rarity tier. */
export function sameRarityTier(
  offered: readonly { rarity: ProductRarity }[],
  requested: readonly { rarity: ProductRarity }[],
): boolean {
  if (offered.length === 0 || requested.length === 0) {
    return false;
  }
  try {
    assertSameRarityTrade([...offered, ...requested]);
    return true;
  } catch {
    return false;
  }
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
    case "VOIDED":
      return "Voided";
    default:
      return state;
  }
}
