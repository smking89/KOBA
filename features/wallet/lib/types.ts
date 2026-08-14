import type { CoinBucket, CoinTxCategory } from "@/lib/generated/prisma/client";

export type WalletSummary = {
  /** purchased + promotional + earned + reserved */
  total: string;
  /** purchased + promotional + earned (spendable now) */
  available: string;
  reserved: string;
  purchased: string;
  promotional: string;
  earned: string;
  currency: "KOBA_COIN";
  status: string;
};

export type CoinTransactionView = {
  publicRef: string;
  category: CoinTxCategory;
  status: string;
  /** Signed net effect on the user's spendable/reserved buckets (string bigint). */
  amount: string;
  bucket: CoinBucket | null;
  createdAt: string;
  description: string;
  direction: "credit" | "debit" | "neutral";
};

export type PaginatedTransactions = {
  items: CoinTransactionView[];
  nextCursor: string | null;
};

/** @deprecated Prefer WalletSummary string amounts for API safety. */
export type WalletSnapshot = {
  totalCoins: number;
  purchased: number;
  promotional: number;
  earned: number;
  reserved: number;
  available?: number;
};

export const COIN_BUCKETS = ["PURCHASED", "PROMOTIONAL", "EARNED", "RESERVED"] as const;
export type { CoinBucket, CoinTxCategory };

export const COIN_TX_CATEGORIES = [
  "ISSUANCE",
  "PROMOTIONAL_GRANT",
  "PURCHASE_CREDIT",
  "RESERVATION",
  "RESERVATION_CAPTURE",
  "RESERVATION_RELEASE",
  "MARKETPLACE_PURCHASE",
  "SELLER_EARNING",
  "PLATFORM_COMMISSION",
  "REFUND",
  "ADMIN_ADJUSTMENT",
  "REVERSAL",
  "PURCHASE",
  "GENERATION_RESERVATION",
  "CAPTURE",
  "RELEASE",
  "PLATFORM_FEE",
] as const;

export function coinCategoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
