/**
 * KOBA Coins — presentation types compatible with a future double-entry ledger.
 * This phase does not mutate balances.
 */

export const COIN_BUCKETS = ["PURCHASED", "PROMOTIONAL", "EARNED", "RESERVED"] as const;

export type CoinBucket = (typeof COIN_BUCKETS)[number];

export const COIN_TX_CATEGORIES = [
  "PURCHASE",
  "GENERATION_RESERVATION",
  "CAPTURE",
  "RELEASE",
  "REFUND",
  "SELLER_EARNING",
  "PLATFORM_FEE",
  "PROMOTIONAL_GRANT",
] as const;

export type CoinTxCategory = (typeof COIN_TX_CATEGORIES)[number];

/** Future ledger primitives (contracts only — no schema migration this phase). */
export type LedgerAccountKind = "USER_WALLET" | "PLATFORM_FEE" | "RESERVE" | "EXTERNAL";

export type LedgerEntrySide = "DEBIT" | "CREDIT";

export type WalletSnapshot = {
  totalCoins: number;
  purchased: number;
  promotional: number;
  earned: number;
  reserved: number;
};

export type CoinTransactionView = {
  id: string;
  category: CoinTxCategory;
  amount: number;
  bucket: CoinBucket | null;
  createdAt: string;
  note: string;
};

export const MOCK_WALLET: WalletSnapshot = {
  totalCoins: 860,
  purchased: 500,
  promotional: 100,
  earned: 320,
  reserved: 60,
};

export const MOCK_COIN_TX: CoinTransactionView[] = [
  {
    id: "ctx-1",
    category: "PURCHASE",
    amount: 500,
    bucket: "PURCHASED",
    createdAt: "2026-08-01T12:00:00.000Z",
    note: "Buy Coins pack (demo — not charged)",
  },
  {
    id: "ctx-2",
    category: "PROMOTIONAL_GRANT",
    amount: 100,
    bucket: "PROMOTIONAL",
    createdAt: "2026-08-02T12:00:00.000Z",
    note: "Welcome grant",
  },
  {
    id: "ctx-3",
    category: "GENERATION_RESERVATION",
    amount: -60,
    bucket: "RESERVED",
    createdAt: "2026-08-14T19:00:00.000Z",
    note: "Reserved for Aiden job KOBA-ADN-JOB0002",
  },
  {
    id: "ctx-4",
    category: "SELLER_EARNING",
    amount: 320,
    bucket: "EARNED",
    createdAt: "2026-08-10T08:00:00.000Z",
    note: "Shop sale attribution (demo)",
  },
  {
    id: "ctx-5",
    category: "PLATFORM_FEE",
    amount: -40,
    bucket: null,
    createdAt: "2026-08-10T08:00:00.000Z",
    note: "Platform fee on earning (demo)",
  },
];

export function coinCategoryLabel(category: CoinTxCategory): string {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
