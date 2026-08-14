import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { WalletError } from "@/features/wallet/lib/errors";
import { generateLedgerRef } from "@/features/wallet/lib/refs";
import type {
  CoinBucket,
  CoinTxCategory,
  CoinTransactionView,
  LedgerEntrySide,
  WalletSnapshot,
} from "@/features/wallet/lib/types";

const PLATFORM_FEE_CODE = "platform:fee";
const EXTERNAL_STRIPE_CODE = "external:stripe";

const BUCKETS: CoinBucket[] = ["PURCHASED", "PROMOTIONAL", "EARNED", "RESERVED"];
const SPEND_ORDER: CoinBucket[] = ["PROMOTIONAL", "PURCHASED", "EARNED"];

function userBucketCode(userId: string, bucket: CoinBucket): string {
  return `user:${userId}:${bucket.toLowerCase()}`;
}

export async function ensureWallet(userId: string) {
  const existing = await prisma.coinWallet.findUnique({
    where: { userId },
    include: { accounts: true },
  });
  if (existing && existing.accounts.length >= 4) {
    await ensureSystemAccounts();
    return existing;
  }

  const wallet =
    existing ??
    (await prisma.coinWallet.create({
      data: { userId },
    }));

  for (const bucket of BUCKETS) {
    const code = userBucketCode(userId, bucket);
    await prisma.ledgerAccount.upsert({
      where: { code },
      create: {
        code,
        kind: "USER_BUCKET",
        bucket,
        walletId: wallet.id,
        userId,
      },
      update: {
        walletId: wallet.id,
        userId,
        kind: "USER_BUCKET",
        bucket,
      },
    });
  }

  await ensureSystemAccounts();
  return prisma.coinWallet.findUniqueOrThrow({
    where: { userId },
    include: { accounts: true },
  });
}

async function ensureSystemAccounts() {
  await prisma.ledgerAccount.upsert({
    where: { code: PLATFORM_FEE_CODE },
    create: { code: PLATFORM_FEE_CODE, kind: "PLATFORM_FEE" },
    update: {},
  });
  await prisma.ledgerAccount.upsert({
    where: { code: EXTERNAL_STRIPE_CODE },
    create: { code: EXTERNAL_STRIPE_CODE, kind: "EXTERNAL" },
    update: {},
  });
}

type PostEntry = {
  accountCode: string;
  side: LedgerEntrySide;
  amount: number;
};

export async function postLedgerTransaction(input: {
  category: CoinTxCategory;
  memo: string;
  entries: PostEntry[];
  actorUserId?: string | null;
  ipAddress?: string | null;
}): Promise<{ id: string; publicRef: string }> {
  if (input.entries.length < 2) {
    throw new WalletError("Ledger transactions require at least two entries.", "INVALID");
  }
  for (const entry of input.entries) {
    if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
      throw new WalletError("Entry amounts must be positive integers.", "INVALID");
    }
  }

  const debitTotal = input.entries
    .filter((entry) => entry.side === "DEBIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const creditTotal = input.entries
    .filter((entry) => entry.side === "CREDIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  if (debitTotal !== creditTotal) {
    throw new WalletError("Ledger transaction is unbalanced.", "UNBALANCED");
  }

  const codes = [...new Set(input.entries.map((entry) => entry.accountCode))];
  const accounts = await prisma.ledgerAccount.findMany({ where: { code: { in: codes } } });
  if (accounts.length !== codes.length) {
    throw new WalletError("One or more ledger accounts are missing.", "NOT_FOUND");
  }
  const byCode = new Map(accounts.map((account) => [account.code, account]));

  const publicRef = generateLedgerRef();
  const tx = await prisma.ledgerTransaction.create({
    data: {
      publicRef,
      category: input.category,
      memo: input.memo,
      entries: {
        create: input.entries.map((entry) => ({
          side: entry.side,
          amount: entry.amount,
          accountId: byCode.get(entry.accountCode)!.id,
        })),
      },
    },
  });

  await writeAuditLog({
    actorUserId: input.actorUserId ?? null,
    action: AuditAction.COIN_LEDGER_POSTED,
    targetType: "LedgerTransaction",
    targetId: tx.id,
    metadata: { publicRef, category: input.category, memo: input.memo },
    ipAddress: input.ipAddress ?? null,
  });

  return { id: tx.id, publicRef };
}

async function accountBalance(accountId: string): Promise<number> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId },
    select: { side: true, amount: true },
  });
  let balance = 0;
  for (const entry of entries) {
    // User asset convention: CREDIT increases, DEBIT decreases
    balance += entry.side === "CREDIT" ? entry.amount : -entry.amount;
  }
  return balance;
}

export async function getWalletSnapshot(userId: string): Promise<WalletSnapshot> {
  await ensureWallet(userId);
  const accounts = await prisma.ledgerAccount.findMany({
    where: { userId, kind: "USER_BUCKET" },
  });

  const balances = {
    PURCHASED: 0,
    PROMOTIONAL: 0,
    EARNED: 0,
    RESERVED: 0,
  } satisfies Record<CoinBucket, number>;

  for (const account of accounts) {
    if (!account.bucket) continue;
    balances[account.bucket] = await accountBalance(account.id);
  }

  const available = balances.PURCHASED + balances.PROMOTIONAL + balances.EARNED;
  return {
    totalCoins: available,
    purchased: balances.PURCHASED,
    promotional: balances.PROMOTIONAL,
    earned: balances.EARNED,
    reserved: balances.RESERVED,
  };
}

export async function listTransactions(userId: string): Promise<CoinTransactionView[]> {
  await ensureWallet(userId);
  const userAccounts = await prisma.ledgerAccount.findMany({
    where: { userId },
    select: { id: true, bucket: true },
  });
  const accountIds = userAccounts.map((account) => account.id);
  const bucketByAccount = new Map(userAccounts.map((account) => [account.id, account.bucket]));

  if (accountIds.length === 0) {
    return [];
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId: { in: accountIds } },
    include: { transaction: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const seen = new Set<string>();
  const views: CoinTransactionView[] = [];

  for (const entry of entries) {
    if (seen.has(entry.transactionId)) continue;
    seen.add(entry.transactionId);

    const related = entries.filter((row) => row.transactionId === entry.transactionId);
    const userBucketEntry =
      related.find((row) => {
        const b = bucketByAccount.get(row.accountId);
        return b != null && b !== "RESERVED";
      }) ?? related[0];
    const bucket: CoinBucket | null = userBucketEntry
      ? (bucketByAccount.get(userBucketEntry.accountId) ?? null)
      : null;
    const signed =
      userBucketEntry == null
        ? 0
        : userBucketEntry.side === "CREDIT"
          ? userBucketEntry.amount
          : -userBucketEntry.amount;

    views.push({
      id: entry.transaction.publicRef,
      category: entry.transaction.category,
      amount: signed,
      bucket,
      createdAt: entry.transaction.createdAt.toISOString(),
      note: entry.transaction.memo,
    });
  }

  return views;
}

export async function grantPromotionalCoins(
  userId: string,
  amount: number,
  memo: string,
  ipAddress?: string | null,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Grant amount must be a positive integer.", "INVALID");
  }
  await ensureWallet(userId);
  return postLedgerTransaction({
    category: "PROMOTIONAL_GRANT",
    memo,
    entries: [
      { accountCode: EXTERNAL_STRIPE_CODE, side: "DEBIT", amount },
      { accountCode: userBucketCode(userId, "PROMOTIONAL"), side: "CREDIT", amount },
    ],
    actorUserId: userId,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
  });
}

export type ReservationResult = {
  transactionId: string;
  publicRef: string;
  allocations: { bucket: CoinBucket; amount: number }[];
};

export async function reserveCoinsForGeneration(
  userId: string,
  amount: number,
  memo: string,
  ipAddress?: string | null,
): Promise<ReservationResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Reservation amount must be a positive integer.", "INVALID");
  }
  await ensureWallet(userId);

  const accounts = await prisma.ledgerAccount.findMany({
    where: { userId, kind: "USER_BUCKET", bucket: { in: SPEND_ORDER } },
  });
  const byBucket = new Map(accounts.map((account) => [account.bucket!, account]));

  let remaining = amount;
  const allocations: { bucket: CoinBucket; amount: number }[] = [];
  for (const bucket of SPEND_ORDER) {
    const account = byBucket.get(bucket);
    if (!account) continue;
    const available = await accountBalance(account.id);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    if (take > 0) {
      allocations.push({ bucket, amount: take });
      remaining -= take;
    }
    if (remaining === 0) break;
  }

  if (remaining > 0) {
    throw new WalletError("Insufficient KOBA Coins available.", "INSUFFICIENT");
  }

  const entries: PostEntry[] = [];
  for (const allocation of allocations) {
    entries.push({
      accountCode: userBucketCode(userId, allocation.bucket),
      side: "DEBIT",
      amount: allocation.amount,
    });
  }
  entries.push({
    accountCode: userBucketCode(userId, "RESERVED"),
    side: "CREDIT",
    amount,
  });

  const tx = await postLedgerTransaction({
    category: "GENERATION_RESERVATION",
    memo,
    entries,
    actorUserId: userId,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
  });

  return {
    transactionId: tx.id,
    publicRef: tx.publicRef,
    allocations,
  };
}

/** Release reserved coins back to promotional (simplified restore). */
export async function releaseReservation(
  userId: string,
  amount: number,
  memo: string,
  ipAddress?: string | null,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Release amount must be a positive integer.", "INVALID");
  }
  await ensureWallet(userId);
  const reservedAccount = await prisma.ledgerAccount.findUnique({
    where: { code: userBucketCode(userId, "RESERVED") },
  });
  if (!reservedAccount) {
    throw new WalletError("Reserved account missing.", "NOT_FOUND");
  }
  const reservedBalance = await accountBalance(reservedAccount.id);
  if (reservedBalance < amount) {
    throw new WalletError("Not enough reserved coins to release.", "INSUFFICIENT");
  }

  return postLedgerTransaction({
    category: "RELEASE",
    memo,
    entries: [
      { accountCode: userBucketCode(userId, "RESERVED"), side: "DEBIT", amount },
      { accountCode: userBucketCode(userId, "PROMOTIONAL"), side: "CREDIT", amount },
    ],
    actorUserId: userId,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
  });
}

/** Capture reserved coins into platform fee (spend). */
export async function captureReservation(
  userId: string,
  amount: number,
  memo: string,
  ipAddress?: string | null,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Capture amount must be a positive integer.", "INVALID");
  }
  await ensureWallet(userId);
  const reservedAccount = await prisma.ledgerAccount.findUnique({
    where: { code: userBucketCode(userId, "RESERVED") },
  });
  if (!reservedAccount) {
    throw new WalletError("Reserved account missing.", "NOT_FOUND");
  }
  const reservedBalance = await accountBalance(reservedAccount.id);
  if (reservedBalance < amount) {
    throw new WalletError("Not enough reserved coins to capture.", "INSUFFICIENT");
  }

  return postLedgerTransaction({
    category: "CAPTURE",
    memo,
    entries: [
      { accountCode: userBucketCode(userId, "RESERVED"), side: "DEBIT", amount },
      { accountCode: PLATFORM_FEE_CODE, side: "CREDIT", amount },
    ],
    actorUserId: userId,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
  });
}

export async function buyCoinsPlaceholder(): Promise<never> {
  throw new WalletError("Coin purchase is not implemented in this phase.", "NOT_IMPLEMENTED");
}
