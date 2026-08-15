/**
 * KOBA Coins double-entry ledger service (server-only).
 *
 * Concurrency: interactive Prisma transactions + `SELECT … FOR UPDATE` on CoinWallet.
 * Idempotency: unique `idempotencyKey` on LedgerTransaction and CoinReservation.
 * Source of truth: immutable LedgerEntry rows; wallet *Balance columns are projections.
 */

import {
  AuditAction,
  type CoinBucket,
  type CoinTxCategory,
  type LedgerAccountKind,
  type Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import {
  assertPositiveCoinAmount,
  parseCoinAmount,
  type CoinAmount,
} from "@/features/wallet/lib/amounts";
import { WalletError } from "@/features/wallet/lib/errors";
import { generateLedgerRef, generateReservationRef } from "@/features/wallet/lib/refs";
import {
  allocateSpend,
  type Allocation,
  type SpendableBucket,
  type SpendPolicy,
} from "@/features/wallet/lib/spending-policy";
import type {
  CoinTransactionView,
  PaginatedTransactions,
  WalletSnapshot,
  WalletSummary,
} from "@/features/wallet/lib/types";

const SYSTEM = {
  treasury: "platform:treasury",
  promoIssuance: "platform:promo-issuance",
  revenue: "platform:revenue",
  refundClearing: "platform:refund-clearing",
  external: "external:settlement",
} as const;

const BUCKET_KIND: Record<CoinBucket, LedgerAccountKind> = {
  PURCHASED: "USER_PURCHASED",
  PROMOTIONAL: "USER_PROMOTIONAL",
  EARNED: "USER_EARNED",
  RESERVED: "USER_RESERVED",
};

type TxClient = Prisma.TransactionClient;

function userBucketCode(userId: string, bucket: CoinBucket): string {
  return `user:${userId}:${bucket.toLowerCase()}`;
}

function requireIdempotencyKey(key: string | undefined | null): string {
  const trimmed = key?.trim() ?? "";
  if (trimmed.length < 8 || trimmed.length > 128) {
    throw new WalletError("Idempotency key must be 8–128 characters.", "INVALID");
  }
  return trimmed;
}

function clampMetadata(metadata: unknown): string | null {
  if (metadata == null) return null;
  const json = JSON.stringify(metadata);
  if (json.length > 2048) {
    throw new WalletError("Metadata exceeds 2KB limit.", "INVALID");
  }
  return json;
}

async function ensureSystemAccounts(db: TxClient | typeof prisma = prisma) {
  const rows: { code: string; kind: LedgerAccountKind }[] = [
    { code: SYSTEM.treasury, kind: "PLATFORM_TREASURY" },
    { code: SYSTEM.promoIssuance, kind: "PLATFORM_PROMO_ISSUANCE" },
    { code: SYSTEM.revenue, kind: "PLATFORM_REVENUE" },
    { code: SYSTEM.refundClearing, kind: "REFUND_CLEARING" },
    { code: SYSTEM.external, kind: "EXTERNAL" },
  ];
  for (const row of rows) {
    await db.ledgerAccount.upsert({
      where: { code: row.code },
      create: { code: row.code, kind: row.kind },
      update: { kind: row.kind },
    });
  }
}

export async function ensureWallet(userId: string) {
  await ensureSystemAccounts();
  const existing = await prisma.coinWallet.findUnique({
    where: { userId },
    include: { accounts: true },
  });
  if (existing) {
    await ensureUserBucketAccounts(userId, existing.id);
    return prisma.coinWallet.findUniqueOrThrow({
      where: { userId },
      include: { accounts: true },
    });
  }
  const wallet = await prisma.coinWallet.create({ data: { userId } });
  await ensureUserBucketAccounts(userId, wallet.id);
  return prisma.coinWallet.findUniqueOrThrow({
    where: { userId },
    include: { accounts: true },
  });
}

async function ensureUserBucketAccounts(
  userId: string,
  walletId: string,
  db: TxClient | typeof prisma = prisma,
) {
  for (const bucket of ["PURCHASED", "PROMOTIONAL", "EARNED", "RESERVED"] as const) {
    const code = userBucketCode(userId, bucket);
    await db.ledgerAccount.upsert({
      where: { code },
      create: {
        code,
        kind: BUCKET_KIND[bucket],
        bucket,
        walletId,
        userId,
      },
      update: {
        kind: BUCKET_KIND[bucket],
        bucket,
        walletId,
        userId,
      },
    });
  }
}

async function lockWallet(db: TxClient, userId: string) {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "CoinWallet" WHERE "userId" = ${userId} FOR UPDATE
  `;
  if (!rows[0]) {
    throw new WalletError("Wallet not found.", "NOT_FOUND");
  }
  return db.coinWallet.findUniqueOrThrow({ where: { id: rows[0].id } });
}

type PostEntryInput = {
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: CoinAmount;
  classification?: CoinBucket | null;
};

async function findPostedByIdempotency(db: TxClient, idempotencyKey: string) {
  return db.ledgerTransaction.findUnique({
    where: { idempotencyKey },
    include: { entries: true },
  });
}

async function postBalanced(
  db: TxClient,
  input: {
    category: CoinTxCategory;
    memo: string;
    idempotencyKey: string;
    entries: PostEntryInput[];
    actorUserId?: string | null;
    walletId?: string | null;
    externalRef?: string | null;
    metadataJson?: string | null;
    reversesTxId?: string | null;
  },
) {
  const existing = await findPostedByIdempotency(db, input.idempotencyKey);
  if (existing) {
    return existing;
  }

  if (input.entries.length < 2) {
    throw new WalletError("Ledger transactions require at least two entries.", "INVALID");
  }

  let debit = 0n;
  let credit = 0n;
  for (const entry of input.entries) {
    assertPositiveCoinAmount(entry.amount);
    if (entry.side === "DEBIT") debit += entry.amount;
    else credit += entry.amount;
  }
  if (debit !== credit) {
    throw new WalletError("Ledger transaction is unbalanced.", "UNBALANCED");
  }

  const codes = [...new Set(input.entries.map((entry) => entry.accountCode))];
  const accounts = await db.ledgerAccount.findMany({ where: { code: { in: codes } } });
  if (accounts.length !== codes.length) {
    throw new WalletError("One or more ledger accounts are missing.", "NOT_FOUND");
  }
  const byCode = new Map(accounts.map((account) => [account.code, account]));

  const publicRef = generateLedgerRef();
  const now = new Date();
  try {
    return await db.ledgerTransaction.create({
      data: {
        publicRef,
        idempotencyKey: input.idempotencyKey,
        category: input.category,
        status: "POSTED",
        memo: input.memo,
        actorUserId: input.actorUserId ?? null,
        walletId: input.walletId ?? null,
        externalRef: input.externalRef ?? null,
        metadataJson: input.metadataJson ?? null,
        postedAt: now,
        reversesTxId: input.reversesTxId ?? null,
        entries: {
          create: input.entries.map((entry) => ({
            side: entry.side,
            amount: entry.amount,
            classification: entry.classification ?? null,
            accountId: byCode.get(entry.accountCode)!.id,
          })),
        },
      },
      include: { entries: true },
    });
  } catch (error) {
    const duplicate = await findPostedByIdempotency(db, input.idempotencyKey);
    if (duplicate) return duplicate;
    throw error;
  }
}

function applyProjectionDelta(
  wallet: {
    purchasedBalance: bigint;
    promotionalBalance: bigint;
    earnedBalance: bigint;
    reservedBalance: bigint;
  },
  bucket: CoinBucket,
  delta: bigint,
) {
  switch (bucket) {
    case "PURCHASED":
      wallet.purchasedBalance += delta;
      break;
    case "PROMOTIONAL":
      wallet.promotionalBalance += delta;
      break;
    case "EARNED":
      wallet.earnedBalance += delta;
      break;
    case "RESERVED":
      wallet.reservedBalance += delta;
      break;
    default:
      break;
  }
}

async function updateProjectionsFromEntries(
  db: TxClient,
  walletId: string,
  entries: PostEntryInput[],
  userId: string,
) {
  const wallet = await db.coinWallet.findUniqueOrThrow({ where: { id: walletId } });
  const next = {
    purchasedBalance: wallet.purchasedBalance,
    promotionalBalance: wallet.promotionalBalance,
    earnedBalance: wallet.earnedBalance,
    reservedBalance: wallet.reservedBalance,
  };

  for (const entry of entries) {
    if (!entry.accountCode.startsWith(`user:${userId}:`)) continue;
    const bucket = entry.classification;
    if (!bucket) continue;
    // Asset convention: CREDIT increases, DEBIT decreases
    const delta = entry.side === "CREDIT" ? entry.amount : -entry.amount;
    applyProjectionDelta(next, bucket, delta);
  }

  for (const key of [
    "purchasedBalance",
    "promotionalBalance",
    "earnedBalance",
    "reservedBalance",
  ] as const) {
    if (next[key] < 0n) {
      throw new WalletError("Projection would go negative.", "INSUFFICIENT");
    }
  }

  await db.coinWallet.update({
    where: { id: walletId },
    data: {
      ...next,
      version: { increment: 1 },
    },
  });
}

function toSummary(wallet: {
  status: string;
  purchasedBalance: bigint;
  promotionalBalance: bigint;
  earnedBalance: bigint;
  reservedBalance: bigint;
}): WalletSummary {
  const available = wallet.purchasedBalance + wallet.promotionalBalance + wallet.earnedBalance;
  const total = available + wallet.reservedBalance;
  return {
    total: total.toString(),
    available: available.toString(),
    reserved: wallet.reservedBalance.toString(),
    purchased: wallet.purchasedBalance.toString(),
    promotional: wallet.promotionalBalance.toString(),
    earned: wallet.earnedBalance.toString(),
    currency: "KOBA_COIN",
    status: wallet.status,
  };
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const wallet = await ensureWallet(userId);
  return toSummary(wallet);
}

/** Back-compat snapshot with number fields (safe integers only). */
export async function getWalletSnapshot(userId: string): Promise<WalletSnapshot> {
  const summary = await getWalletSummary(userId);
  const n = (value: string) => {
    const parsed = BigInt(value);
    if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new WalletError("Balance exceeds safe display range.", "INVALID");
    }
    return Number(parsed);
  };
  return {
    totalCoins: n(summary.available),
    purchased: n(summary.purchased),
    promotional: n(summary.promotional),
    earned: n(summary.earned),
    reserved: n(summary.reserved),
    available: n(summary.available),
  };
}

export async function reconcileWallet(userId: string): Promise<{
  summary: WalletSummary;
  matched: boolean;
  ledger: WalletSummary;
}> {
  const wallet = await ensureWallet(userId);
  const accounts = await prisma.ledgerAccount.findMany({
    where: { userId, bucket: { not: null } },
    include: { entries: { where: { transaction: { status: "POSTED" } } } },
  });

  const ledgerBalances = {
    PURCHASED: 0n,
    PROMOTIONAL: 0n,
    EARNED: 0n,
    RESERVED: 0n,
  } satisfies Record<CoinBucket, bigint>;

  for (const account of accounts) {
    if (!account.bucket) continue;
    let balance = 0n;
    for (const entry of account.entries) {
      balance += entry.side === "CREDIT" ? entry.amount : -entry.amount;
    }
    ledgerBalances[account.bucket] = balance;
  }

  const ledgerSummary: WalletSummary = {
    purchased: ledgerBalances.PURCHASED.toString(),
    promotional: ledgerBalances.PROMOTIONAL.toString(),
    earned: ledgerBalances.EARNED.toString(),
    reserved: ledgerBalances.RESERVED.toString(),
    available: (
      ledgerBalances.PURCHASED +
      ledgerBalances.PROMOTIONAL +
      ledgerBalances.EARNED
    ).toString(),
    total: (
      ledgerBalances.PURCHASED +
      ledgerBalances.PROMOTIONAL +
      ledgerBalances.EARNED +
      ledgerBalances.RESERVED
    ).toString(),
    currency: "KOBA_COIN",
    status: wallet.status,
  };

  const matched =
    wallet.purchasedBalance === ledgerBalances.PURCHASED &&
    wallet.promotionalBalance === ledgerBalances.PROMOTIONAL &&
    wallet.earnedBalance === ledgerBalances.EARNED &&
    wallet.reservedBalance === ledgerBalances.RESERVED;

  if (!matched) {
    await prisma.coinWallet.update({
      where: { id: wallet.id },
      data: {
        purchasedBalance: ledgerBalances.PURCHASED,
        promotionalBalance: ledgerBalances.PROMOTIONAL,
        earnedBalance: ledgerBalances.EARNED,
        reservedBalance: ledgerBalances.RESERVED,
        version: { increment: 1 },
      },
    });
  }

  const summary = await getWalletSummary(userId);
  return { summary, matched, ledger: ledgerSummary };
}

export async function getTransactionHistory(
  userId: string,
  options?: { cursor?: string | null; limit?: number },
): Promise<PaginatedTransactions> {
  await ensureWallet(userId);
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const wallet = await prisma.coinWallet.findUniqueOrThrow({ where: { userId } });

  const rows = await prisma.ledgerTransaction.findMany({
    where: {
      walletId: wallet.id,
      ...(options?.cursor ? { createdAt: { lt: new Date(options.cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      entries: {
        include: { account: true },
      },
    },
  });

  const page = rows.slice(0, limit);
  const items: CoinTransactionView[] = page.map((tx) => {
    const userEntries = tx.entries.filter((entry) => entry.account.userId === userId);
    let net = 0n;
    let bucket: CoinBucket | null = null;
    for (const entry of userEntries) {
      const signed = entry.side === "CREDIT" ? entry.amount : -entry.amount;
      net += signed;
      if (entry.classification) bucket = entry.classification;
    }
    const direction = net > 0n ? "credit" : net < 0n ? "debit" : "neutral";
    return {
      publicRef: tx.publicRef,
      category: tx.category,
      status: tx.status,
      amount: net.toString(),
      bucket,
      createdAt: tx.createdAt.toISOString(),
      description: tx.memo,
      direction,
    };
  });

  const nextCursor =
    rows.length > limit ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null;

  return { items, nextCursor };
}

export async function getTransactionByRef(userId: string, publicRef: string) {
  const wallet = await ensureWallet(userId);
  const tx = await prisma.ledgerTransaction.findUnique({
    where: { publicRef },
    include: { entries: { include: { account: true } } },
  });
  if (!tx || tx.walletId !== wallet.id) {
    throw new WalletError("Transaction not found.", "NOT_FOUND");
  }
  const history = await getTransactionHistory(userId, { limit: 100 });
  const match = history.items.find((item) => item.publicRef === publicRef);
  if (!match) {
    throw new WalletError("Transaction not found.", "NOT_FOUND");
  }
  return match;
}

/** @deprecated Prefer getTransactionHistory */
export async function listTransactions(userId: string) {
  const page = await getTransactionHistory(userId, { limit: 80 });
  return page.items.map((item) => ({
    id: item.publicRef,
    category: item.category,
    amount: Number(item.amount),
    bucket: item.bucket,
    createdAt: item.createdAt,
    note: item.description,
  }));
}

export async function grantPromotionalCoins(input: {
  userId: string;
  amount: CoinAmount | number | string;
  memo: string;
  idempotencyKey: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
}) {
  const amount = parseCoinAmount(input.amount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

  return prisma.$transaction(async (db) => {
    await ensureSystemAccounts(db);
    let wallet = await db.coinWallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) {
      wallet = await db.coinWallet.create({ data: { userId: input.userId } });
    }
    await ensureUserBucketAccounts(input.userId, wallet.id, db);
    await lockWallet(db, input.userId);

    const prior = await findPostedByIdempotency(db, idempotencyKey);
    if (prior) {
      return { id: prior.id, publicRef: prior.publicRef, idempotencyKey };
    }

    const entries: PostEntryInput[] = [
      {
        accountCode: SYSTEM.promoIssuance,
        side: "DEBIT",
        amount,
      },
      {
        accountCode: userBucketCode(input.userId, "PROMOTIONAL"),
        side: "CREDIT",
        amount,
        classification: "PROMOTIONAL",
      },
    ];

    const tx = await postBalanced(db, {
      category: "PROMOTIONAL_GRANT",
      memo: input.memo,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? input.userId,
      walletId: wallet.id,
    });

    await updateProjectionsFromEntries(db, wallet.id, entries, input.userId);

    await writeAuditLog({
      actorUserId: input.actorUserId ?? input.userId,
      action: AuditAction.COIN_LEDGER_POSTED,
      targetType: "LedgerTransaction",
      targetId: tx.id,
      metadata: { publicRef: tx.publicRef, category: tx.category, idempotencyKey },
      ipAddress: input.ipAddress ?? null,
    });

    return { id: tx.id, publicRef: tx.publicRef, idempotencyKey };
  });
}

export async function creditPurchasedCoins(input: {
  userId: string;
  amount: CoinAmount | number | string;
  memo: string;
  idempotencyKey: string;
  externalRef?: string | null;
  actorUserId?: string | null;
  ipAddress?: string | null;
}) {
  const amount = parseCoinAmount(input.amount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

  return prisma.$transaction(async (db) => {
    await ensureSystemAccounts(db);
    let wallet = await db.coinWallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) wallet = await db.coinWallet.create({ data: { userId: input.userId } });
    await ensureUserBucketAccounts(input.userId, wallet.id, db);
    await lockWallet(db, input.userId);

    const prior = await findPostedByIdempotency(db, idempotencyKey);
    if (prior) {
      return { id: prior.id, publicRef: prior.publicRef };
    }

    const entries: PostEntryInput[] = [
      { accountCode: SYSTEM.external, side: "DEBIT", amount },
      {
        accountCode: userBucketCode(input.userId, "PURCHASED"),
        side: "CREDIT",
        amount,
        classification: "PURCHASED",
      },
    ];

    const tx = await postBalanced(db, {
      category: "PURCHASE_CREDIT",
      memo: input.memo,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? null,
      walletId: wallet.id,
      externalRef: input.externalRef ?? null,
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.userId);
    await writeAuditLog({
      actorUserId: input.actorUserId ?? null,
      action: AuditAction.COIN_LEDGER_POSTED,
      targetType: "LedgerTransaction",
      targetId: tx.id,
      metadata: { publicRef: tx.publicRef, category: tx.category },
      ipAddress: input.ipAddress ?? null,
    });
    return { id: tx.id, publicRef: tx.publicRef };
  });
}

export type ReserveCoinsResult = {
  publicRef: string;
  amount: string;
  status: string;
  allocations: { bucket: SpendableBucket; amount: string }[];
  reserveTxPublicRef: string;
};

export async function reserveCoins(input: {
  userId: string;
  amount: CoinAmount | number | string;
  purpose: string;
  idempotencyKey: string;
  expiresAt?: Date | null;
  metadata?: unknown;
  policy?: Partial<SpendPolicy>;
  actorUserId?: string | null;
  ipAddress?: string | null;
}): Promise<ReserveCoinsResult> {
  const amount = parseCoinAmount(input.amount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  if (!input.purpose.trim()) {
    throw new WalletError("Reservation purpose is required.", "INVALID");
  }

  return prisma.$transaction(async (db) => {
    const existing = await db.coinReservation.findUnique({ where: { idempotencyKey } });
    if (existing) {
      const allocations = JSON.parse(existing.allocationsJson) as Allocation[];
      const reserveTx = existing.reserveTxId
        ? await db.ledgerTransaction.findUnique({ where: { id: existing.reserveTxId } })
        : null;
      return {
        publicRef: existing.publicRef,
        amount: existing.amount.toString(),
        status: existing.status,
        allocations: allocations.map((row) => ({
          bucket: row.bucket,
          amount: row.amount.toString(),
        })),
        reserveTxPublicRef: reserveTx?.publicRef ?? "",
      };
    }

    await ensureSystemAccounts(db);
    let wallet = await db.coinWallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) wallet = await db.coinWallet.create({ data: { userId: input.userId } });
    await ensureUserBucketAccounts(input.userId, wallet.id, db);
    wallet = await lockWallet(db, input.userId);

    if (wallet.status !== "ACTIVE") {
      throw new WalletError("Wallet is not active.", "FORBIDDEN");
    }

    let allocations: Allocation[];
    try {
      allocations = allocateSpend(
        amount,
        {
          PROMOTIONAL: wallet.promotionalBalance,
          PURCHASED: wallet.purchasedBalance,
          EARNED: wallet.earnedBalance,
        },
        input.policy,
      );
    } catch {
      throw new WalletError("Insufficient KOBA Coins available.", "INSUFFICIENT");
    }

    const entries: PostEntryInput[] = [];
    for (const allocation of allocations) {
      entries.push({
        accountCode: userBucketCode(input.userId, allocation.bucket),
        side: "DEBIT",
        amount: allocation.amount,
        classification: allocation.bucket,
      });
    }
    entries.push({
      accountCode: userBucketCode(input.userId, "RESERVED"),
      side: "CREDIT",
      amount,
      classification: "RESERVED",
    });

    const tx = await postBalanced(db, {
      category: "RESERVATION",
      memo: input.purpose,
      idempotencyKey: `reserve-tx:${idempotencyKey}`,
      entries,
      actorUserId: input.actorUserId ?? input.userId,
      walletId: wallet.id,
      metadataJson: clampMetadata(input.metadata),
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.userId);

    const reservation = await db.coinReservation.create({
      data: {
        publicRef: generateReservationRef(),
        walletId: wallet.id,
        amount,
        allocationsJson: JSON.stringify(
          allocations.map((row) => ({ bucket: row.bucket, amount: row.amount.toString() })),
        ),
        purpose: input.purpose,
        status: "ACTIVE",
        idempotencyKey,
        expiresAt: input.expiresAt ?? null,
        metadataJson: clampMetadata(input.metadata),
        reserveTxId: tx.id,
      },
    });

    await writeAuditLog({
      actorUserId: input.actorUserId ?? input.userId,
      action: AuditAction.COIN_LEDGER_POSTED,
      targetType: "CoinReservation",
      targetId: reservation.id,
      metadata: { publicRef: reservation.publicRef, amount: amount.toString() },
      ipAddress: input.ipAddress ?? null,
    });

    return {
      publicRef: reservation.publicRef,
      amount: amount.toString(),
      status: reservation.status,
      allocations: allocations.map((row) => ({
        bucket: row.bucket,
        amount: row.amount.toString(),
      })),
      reserveTxPublicRef: tx.publicRef,
    };
  });
}

function parseAllocations(json: string): Allocation[] {
  const raw = JSON.parse(json) as { bucket: SpendableBucket; amount: string }[];
  return raw.map((row) => ({ bucket: row.bucket, amount: BigInt(row.amount) }));
}

export async function captureReservation(input: {
  userId: string;
  reservationPublicRef: string;
  idempotencyKey: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
}) {
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

  return prisma.$transaction(async (db) => {
    const reservation = await db.coinReservation.findUnique({
      where: { publicRef: input.reservationPublicRef },
    });
    if (!reservation) throw new WalletError("Reservation not found.", "NOT_FOUND");

    const wallet = await lockWallet(
      db,
      (await db.coinWallet.findUniqueOrThrow({ where: { id: reservation.walletId } })).userId,
    );
    if (wallet.userId !== input.userId) {
      throw new WalletError("Reservation does not belong to this wallet.", "FORBIDDEN");
    }

    if (reservation.status === "CAPTURED" && reservation.captureTxId) {
      const prior = await db.ledgerTransaction.findUniqueOrThrow({
        where: { id: reservation.captureTxId },
      });
      return {
        publicRef: reservation.publicRef,
        status: reservation.status,
        txPublicRef: prior.publicRef,
      };
    }
    if (reservation.status !== "ACTIVE") {
      throw new WalletError(
        `Cannot capture reservation in status ${reservation.status}.`,
        "CONFLICT",
      );
    }

    const amount = reservation.amount;
    const entries: PostEntryInput[] = [
      {
        accountCode: userBucketCode(input.userId, "RESERVED"),
        side: "DEBIT",
        amount,
        classification: "RESERVED",
      },
      { accountCode: SYSTEM.revenue, side: "CREDIT", amount },
    ];

    const tx = await postBalanced(db, {
      category: "RESERVATION_CAPTURE",
      memo: `Capture ${reservation.publicRef}`,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? input.userId,
      walletId: wallet.id,
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.userId);

    await db.coinReservation.update({
      where: { id: reservation.id },
      data: {
        status: "CAPTURED",
        captureTxId: tx.id,
        capturedAt: new Date(),
      },
    });

    return { publicRef: reservation.publicRef, status: "CAPTURED", txPublicRef: tx.publicRef };
  });
}

export async function settleReservation(input: {
  userId: string;
  reservationPublicRef: string;
  captureAmount: CoinAmount | number | string;
  idempotencyKey: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
}) {
  const captureAmount = parseCoinAmount(input.captureAmount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

  return prisma.$transaction(async (db) => {
    const reservation = await db.coinReservation.findUnique({
      where: { publicRef: input.reservationPublicRef },
    });
    if (!reservation) throw new WalletError("Reservation not found.", "NOT_FOUND");

    const wallet = await lockWallet(
      db,
      (await db.coinWallet.findUniqueOrThrow({ where: { id: reservation.walletId } })).userId,
    );
    if (wallet.userId !== input.userId) {
      throw new WalletError("Reservation does not belong to this wallet.", "FORBIDDEN");
    }

    if (reservation.status === "CAPTURED" && reservation.captureTxId) {
      const prior = await db.ledgerTransaction.findUniqueOrThrow({
        where: { id: reservation.captureTxId },
      });
      return {
        publicRef: reservation.publicRef,
        status: reservation.status,
        captured: reservation.amount.toString(),
        released: "0",
        txPublicRef: prior.publicRef,
      };
    }
    if (reservation.status !== "ACTIVE") {
      throw new WalletError(
        `Cannot settle reservation in status ${reservation.status}.`,
        "CONFLICT",
      );
    }
    if (captureAmount > reservation.amount) {
      throw new WalletError("Capture exceeds the reserved amount.", "INVALID");
    }

    const remainder = reservation.amount - captureAmount;
    const entries: PostEntryInput[] = [
      {
        accountCode: userBucketCode(input.userId, "RESERVED"),
        side: "DEBIT",
        amount: reservation.amount,
        classification: "RESERVED",
      },
      { accountCode: SYSTEM.revenue, side: "CREDIT", amount: captureAmount },
    ];

    if (remainder > 0n) {
      const allocations = parseAllocations(reservation.allocationsJson);
      let left = remainder;
      for (const allocation of [...allocations].reverse()) {
        if (left <= 0n) break;
        const take = allocation.amount < left ? allocation.amount : left;
        if (take > 0n) {
          entries.push({
            accountCode: userBucketCode(input.userId, allocation.bucket),
            side: "CREDIT",
            amount: take,
            classification: allocation.bucket,
          });
          left -= take;
        }
      }
      if (left !== 0n) {
        throw new WalletError("Could not allocate reservation remainder.", "UNBALANCED");
      }
    }

    const tx = await postBalanced(db, {
      category: "RESERVATION_CAPTURE",
      memo: `Settle ${reservation.publicRef} capture=${captureAmount} release=${remainder}`,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? input.userId,
      walletId: wallet.id,
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.userId);

    await db.coinReservation.update({
      where: { id: reservation.id },
      data: {
        status: "CAPTURED",
        captureTxId: tx.id,
        capturedAt: new Date(),
        releasedAt: remainder > 0n ? new Date() : null,
      },
    });

    return {
      publicRef: reservation.publicRef,
      status: "CAPTURED" as const,
      captured: captureAmount.toString(),
      released: remainder.toString(),
      txPublicRef: tx.publicRef,
    };
  });
}

export async function releaseReservation(input: {
  userId: string;
  reservationPublicRef: string;
  idempotencyKey: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  asExpired?: boolean;
}) {
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

  return prisma.$transaction(async (db) => {
    const reservation = await db.coinReservation.findUnique({
      where: { publicRef: input.reservationPublicRef },
    });
    if (!reservation) throw new WalletError("Reservation not found.", "NOT_FOUND");

    const walletRow = await db.coinWallet.findUniqueOrThrow({
      where: { id: reservation.walletId },
    });
    if (walletRow.userId !== input.userId) {
      throw new WalletError("Reservation does not belong to this wallet.", "FORBIDDEN");
    }
    await lockWallet(db, input.userId);

    if (
      reservation.status === "RELEASED" ||
      reservation.status === "EXPIRED" ||
      reservation.status === "CANCELLED"
    ) {
      const prior = reservation.releaseTxId
        ? await db.ledgerTransaction.findUnique({ where: { id: reservation.releaseTxId } })
        : null;
      return {
        publicRef: reservation.publicRef,
        status: reservation.status,
        txPublicRef: prior?.publicRef ?? null,
      };
    }
    if (reservation.status === "CAPTURED") {
      throw new WalletError("Cannot release a captured reservation.", "CONFLICT");
    }
    if (reservation.status !== "ACTIVE" && reservation.status !== "PENDING") {
      throw new WalletError(
        `Cannot release reservation in status ${reservation.status}.`,
        "CONFLICT",
      );
    }

    const allocations = parseAllocations(reservation.allocationsJson);
    const entries: PostEntryInput[] = [
      {
        accountCode: userBucketCode(input.userId, "RESERVED"),
        side: "DEBIT",
        amount: reservation.amount,
        classification: "RESERVED",
      },
    ];
    for (const allocation of allocations) {
      entries.push({
        accountCode: userBucketCode(input.userId, allocation.bucket),
        side: "CREDIT",
        amount: allocation.amount,
        classification: allocation.bucket,
      });
    }

    const tx = await postBalanced(db, {
      category: "RESERVATION_RELEASE",
      memo: `Release ${reservation.publicRef}`,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? input.userId,
      walletId: walletRow.id,
    });
    await updateProjectionsFromEntries(db, walletRow.id, entries, input.userId);

    const status = input.asExpired ? "EXPIRED" : "RELEASED";
    await db.coinReservation.update({
      where: { id: reservation.id },
      data: {
        status,
        releaseTxId: tx.id,
        releasedAt: new Date(),
      },
    });

    return { publicRef: reservation.publicRef, status, txPublicRef: tx.publicRef };
  });
}

export async function expireReservations(now = new Date()) {
  const due = await prisma.coinReservation.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    include: { wallet: true },
    take: 100,
  });
  const results = [];
  for (const reservation of due) {
    results.push(
      await releaseReservation({
        userId: reservation.wallet.userId,
        reservationPublicRef: reservation.publicRef,
        idempotencyKey: `expire:${reservation.publicRef}`,
        asExpired: true,
      }),
    );
  }
  return results;
}

export async function reverseTransaction(input: {
  userId: string;
  publicRef: string;
  idempotencyKey: string;
  reason: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  if (!input.reason.trim()) {
    throw new WalletError("Reversal reason is required.", "INVALID");
  }

  return prisma.$transaction(async (db) => {
    const original = await db.ledgerTransaction.findUnique({
      where: { publicRef: input.publicRef },
      include: { entries: { include: { account: true } } },
    });
    if (!original) throw new WalletError("Transaction not found.", "NOT_FOUND");
    const wallet = await lockWallet(db, input.userId);
    if (original.walletId !== wallet.id) {
      throw new WalletError("Transaction does not belong to this wallet.", "FORBIDDEN");
    }
    if (original.status === "REVERSED" && original.reversedByTxId) {
      const prior = await db.ledgerTransaction.findUniqueOrThrow({
        where: { id: original.reversedByTxId },
      });
      return { publicRef: prior.publicRef, status: "REVERSED" as const };
    }
    if (original.status !== "POSTED") {
      throw new WalletError("Only posted transactions can be reversed.", "CONFLICT");
    }

    const entries: PostEntryInput[] = original.entries.map((entry) => ({
      accountCode: entry.account.code,
      side: entry.side === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: entry.amount,
      classification: entry.classification,
    }));

    const tx = await postBalanced(db, {
      category: "REVERSAL",
      memo: input.reason,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId,
      walletId: wallet.id,
      reversesTxId: original.id,
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.userId);
    await db.ledgerTransaction.update({
      where: { id: original.id },
      data: { status: "REVERSED", reversedAt: new Date(), reversedByTxId: tx.id },
    });

    return { publicRef: tx.publicRef, status: "REVERSED" as const };
  });
}

export async function refundTransaction(input: {
  userId: string;
  publicRef: string;
  idempotencyKey: string;
  reason: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  return reverseTransaction({ ...input, reason: `Refund: ${input.reason}` });
}

export async function recordSellerEarning(input: {
  sellerUserId: string;
  amount: CoinAmount | number | string;
  memo: string;
  idempotencyKey: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
}) {
  const amount = parseCoinAmount(input.amount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  return prisma.$transaction(async (db) => {
    await ensureSystemAccounts(db);
    let wallet = await db.coinWallet.findUnique({ where: { userId: input.sellerUserId } });
    if (!wallet) wallet = await db.coinWallet.create({ data: { userId: input.sellerUserId } });
    await ensureUserBucketAccounts(input.sellerUserId, wallet.id, db);
    await lockWallet(db, input.sellerUserId);
    const entries: PostEntryInput[] = [
      { accountCode: SYSTEM.treasury, side: "DEBIT", amount },
      {
        accountCode: userBucketCode(input.sellerUserId, "EARNED"),
        side: "CREDIT",
        amount,
        classification: "EARNED",
      },
    ];
    const tx = await postBalanced(db, {
      category: "SELLER_EARNING",
      memo: input.memo,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? null,
      walletId: wallet.id,
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.sellerUserId);
    return { publicRef: tx.publicRef };
  });
}

export async function recordPlatformCommission(input: {
  amount: CoinAmount | number | string;
  memo: string;
  idempotencyKey: string;
  relatedUserId?: string | null;
  actorUserId?: string | null;
}) {
  const amount = parseCoinAmount(input.amount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  return prisma.$transaction(async (db) => {
    await ensureSystemAccounts(db);
    const entries: PostEntryInput[] = [
      { accountCode: SYSTEM.treasury, side: "DEBIT", amount },
      { accountCode: SYSTEM.revenue, side: "CREDIT", amount },
    ];
    const tx = await postBalanced(db, {
      category: "PLATFORM_COMMISSION",
      memo: input.memo,
      idempotencyKey,
      entries,
      actorUserId: input.actorUserId ?? null,
      walletId: null,
    });
    return { publicRef: tx.publicRef };
  });
}

export async function staffAdjustCoins(input: {
  targetUserId: string;
  amount: CoinAmount | number | string;
  bucket: SpendableBucket;
  direction: "credit" | "debit";
  reason: string;
  idempotencyKey: string;
  staffUserId: string;
  staffAccountType: string | null | undefined;
  ipAddress?: string | null;
}) {
  const staffOk =
    input.staffAccountType === "SUPERADMIN" ||
    input.staffAccountType === "ADMIN" ||
    input.staffAccountType === "MODERATOR";
  if (!staffOk) {
    throw new WalletError("Staff authorisation required.", "FORBIDDEN");
  }
  if (!input.reason.trim()) {
    throw new WalletError("Adjustment reason is required.", "INVALID");
  }
  const amount = parseCoinAmount(input.amount);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

  return prisma.$transaction(async (db) => {
    await ensureSystemAccounts(db);
    let wallet = await db.coinWallet.findUnique({ where: { userId: input.targetUserId } });
    if (!wallet) wallet = await db.coinWallet.create({ data: { userId: input.targetUserId } });
    await ensureUserBucketAccounts(input.targetUserId, wallet.id, db);
    await lockWallet(db, input.targetUserId);

    const userCode = userBucketCode(input.targetUserId, input.bucket);
    const entries: PostEntryInput[] =
      input.direction === "credit"
        ? [
            { accountCode: SYSTEM.treasury, side: "DEBIT", amount },
            { accountCode: userCode, side: "CREDIT", amount, classification: input.bucket },
          ]
        : [
            { accountCode: userCode, side: "DEBIT", amount, classification: input.bucket },
            { accountCode: SYSTEM.treasury, side: "CREDIT", amount },
          ];

    const tx = await postBalanced(db, {
      category: "ADMIN_ADJUSTMENT",
      memo: input.reason,
      idempotencyKey,
      entries,
      actorUserId: input.staffUserId,
      walletId: wallet.id,
    });
    await updateProjectionsFromEntries(db, wallet.id, entries, input.targetUserId);
    return { publicRef: tx.publicRef };
  });
}

/**
 * Compatibility wrapper for older Aiden call sites.
 * Prefer `reserveCoins`.
 */
export async function reserveCoinsForGeneration(
  userId: string,
  amount: number,
  memo: string,
  ipAddress?: string | null,
) {
  const result = await reserveCoins({
    userId,
    amount,
    purpose: memo,
    idempotencyKey: `aiden-reserve:${userId}:${memo}`.slice(0, 128),
    ...(ipAddress !== undefined ? { ipAddress } : {}),
  });
  return {
    transactionId: result.publicRef,
    publicRef: result.reserveTxPublicRef,
    allocations: result.allocations.map((row) => ({
      bucket: row.bucket as CoinBucket,
      amount: Number(row.amount),
    })),
    reservationPublicRef: result.publicRef,
  };
}

export async function buyCoinsPlaceholder(): Promise<never> {
  throw new WalletError("Coin purchase is not implemented in this phase.", "NOT_IMPLEMENTED");
}
