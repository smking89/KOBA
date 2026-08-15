import type { TradeItemView, TradeOfferView } from "@/features/trade/lib/types";
import { RARITY_VALUE_WARNING, sameRarityTier } from "@/features/trade/lib/types";

export const MOCK_TRADE_INVENTORY: TradeItemView[] = [
  {
    id: "inv-1",
    inventoryPublicRef: "KOBA-INV-SEED0001",
    title: "Oxide Camo Crest",
    game: "Rust",
    platform: "STEAM",
    rarity: "EPIC",
    ownerHandle: "maxbuilds",
    owned: true,
    locked: false,
    eligible: true,
    eligibilityNote: "Eligible — ownership must be re-checked on the server.",
  },
  {
    id: "inv-2",
    inventoryPublicRef: "KOBA-INV-SEED0004",
    title: "Wyvern Profile Effect",
    game: "Garry's Mod",
    platform: "STEAM",
    rarity: "EPIC",
    ownerHandle: "ironwright",
    owned: false,
    locked: false,
    eligible: true,
    eligibilityNote: "Listed for trade — rarity tier EPIC.",
  },
  {
    id: "inv-3",
    inventoryPublicRef: "KOBA-INV-SEED0006",
    title: "Ember Wake Relic",
    game: "DayZ",
    platform: "STEAM",
    rarity: "RELIC",
    ownerHandle: "ironwright",
    owned: false,
    locked: true,
    eligible: false,
    eligibilityNote: "Locked — active auction reservation.",
  },
  {
    id: "inv-4",
    inventoryPublicRef: "KOBA-INV-SEED0003",
    title: "Trader Skin Pack",
    game: "Rust",
    platform: "STEAM",
    rarity: "COMMON",
    ownerHandle: "maxbuilds",
    owned: true,
    locked: false,
    eligible: true,
    eligibilityNote: "Eligible — COMMON tier only trades with COMMON.",
  },
];

const pendingOffered = [MOCK_TRADE_INVENTORY[0]!];
const pendingRequested = [MOCK_TRADE_INVENTORY[1]!];

export const MOCK_TRADES: TradeOfferView[] = [
  {
    publicRef: "KOBA-TRD-DEMO0001",
    state: "PENDING",
    rarityTier: "EPIC",
    createdAt: "2026-08-14T18:00:00.000Z",
    expiresAt: "2026-08-16T18:00:00.000Z",
    proposerHandle: "maxbuilds",
    counterpartyHandle: "ironwright",
    offered: pendingOffered,
    requested: pendingRequested,
    sameRarityRuleOk: sameRarityTier(pendingOffered, pendingRequested),
    note: "Even swap — both EPIC cosmetics.",
    parentPublicRef: null,
    valueWarning: RARITY_VALUE_WARNING,
    viewerRole: null,
  },
  {
    publicRef: "KOBA-TRD-DEMO0002",
    state: "COMPLETED",
    rarityTier: "COMMON",
    createdAt: "2026-08-10T12:00:00.000Z",
    expiresAt: null,
    proposerHandle: "raidmaps",
    counterpartyHandle: "maxbuilds",
    offered: [MOCK_TRADE_INVENTORY[3]!],
    requested: [
      {
        ...MOCK_TRADE_INVENTORY[3]!,
        id: "inv-5",
        inventoryPublicRef: "KOBA-INV-SEED0005",
        title: "Starter Kit Skin",
        ownerHandle: "raidmaps",
        owned: false,
      },
    ],
    sameRarityRuleOk: true,
    note: null,
    parentPublicRef: null,
    valueWarning: RARITY_VALUE_WARNING,
    viewerRole: null,
  },
  {
    publicRef: "KOBA-TRD-DEMO0003",
    state: "DISPUTED",
    rarityTier: "EPIC",
    createdAt: "2026-08-12T09:00:00.000Z",
    expiresAt: null,
    proposerHandle: "maxbuilds",
    counterpartyHandle: "ironwright",
    offered: [MOCK_TRADE_INVENTORY[0]!],
    requested: [MOCK_TRADE_INVENTORY[2]!],
    sameRarityRuleOk: false,
    note: "Invalid cross-rarity attempt (demo). Server must reject.",
    parentPublicRef: null,
    valueWarning: RARITY_VALUE_WARNING,
    viewerRole: null,
  },
];

export function getMockTrade(publicRef: string): TradeOfferView | undefined {
  return MOCK_TRADES.find((trade) => trade.publicRef === publicRef);
}
