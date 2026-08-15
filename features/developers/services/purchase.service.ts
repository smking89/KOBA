import { AuditAction } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/features/auth/services/audit-log.service";
import { canStaffRefund } from "@/features/admin/lib/access";
import { DeveloperError } from "@/features/developers/lib/errors";
import { developerCommissionBps, splitCoinPurchase } from "@/features/developers/lib/pricing";
import { generateDevPurchaseRef } from "@/features/developers/lib/refs";
import { isPublicDevState } from "@/features/developers/lib/state-machine";
import { enqueueWebhookEvent } from "@/features/developers/services/webhook.service";
import {
  reverseTransaction,
  spendCoinsSplit,
  staffAdjustCoins,
} from "@/features/wallet/services/ledger.service";
import { WalletError } from "@/features/wallet/lib/errors";

function serializePurchase(row: {
  publicRef: string;
  status: string;
  priceCoins: bigint;
  feeCoins: bigint;
  sellerCoins: bigint;
  commissionBps: number;
  proceedsUnrecoverable: boolean;
  refundReason: string | null;
  createdAt: Date;
}) {
  return {
    publicRef: row.publicRef,
    status: row.status,
    priceCoins: row.priceCoins.toString(),
    feeCoins: row.feeCoins.toString(),
    sellerCoins: row.sellerCoins.toString(),
    commissionBps: row.commissionBps,
    proceedsUnrecoverable: row.proceedsUnrecoverable,
    refundReason: row.refundReason,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadActorTypes(userId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  return actor?.kobaIdentities.map((row) => row.accountType) ?? [];
}

export async function purchaseProduct(
  buyerUserId: string,
  slugOrRef: string,
  idempotencyKey: string,
  ipAddress?: string | null,
) {
  const prior = await prisma.devPurchase.findUnique({ where: { idempotencyKey } });
  if (prior) return { ...serializePurchase(prior), duplicate: true as const };

  const product = await prisma.devProduct.findFirst({
    where: { OR: [{ slug: slugOrRef }, { publicRef: slugOrRef }] },
    include: { profile: true },
  });
  if (!product) throw new DeveloperError("Product not found.", "NOT_FOUND");
  if (!isPublicDevState(product.reviewState) || product.suspendedAt) {
    throw new DeveloperError("This product is not available for purchase.", "FORBIDDEN");
  }
  if (product.pricing === "COMING_SOON") {
    throw new DeveloperError("This product is not for sale yet.", "INVALID");
  }
  if (product.ownerUserId === buyerUserId || product.profile?.ownerUserId === buyerUserId) {
    throw new DeveloperError("You cannot buy your own product.", "FORBIDDEN");
  }

  const existingEntitlement = await prisma.devEntitlement.findUnique({
    where: { userId_productId: { userId: buyerUserId, productId: product.id } },
  });
  if (existingEntitlement && !existingEntitlement.revokedAt) {
    throw new DeveloperError("You already own this product.", "CONFLICT");
  }

  const paidOpen = await prisma.devPurchase.findFirst({
    where: { buyerUserId, productId: product.id, status: "PAID" },
  });
  if (paidOpen) {
    return { ...serializePurchase(paidOpen), duplicate: true as const };
  }

  const priceCoins = product.priceCoins;
  if (product.pricing === "FREE" || priceCoins <= 0n) {
    await prisma.devEntitlement.upsert({
      where: { userId_productId: { userId: buyerUserId, productId: product.id } },
      create: { userId: buyerUserId, productId: product.id, source: "FREE" },
      update: { revokedAt: null, source: "FREE" },
    });
    await prisma.devInstall.upsert({
      where: { productId_userId: { productId: product.id, userId: buyerUserId } },
      create: { productId: product.id, userId: buyerUserId },
      update: { revokedAt: null },
    });
    const purchase = await prisma.devPurchase.create({
      data: {
        publicRef: generateDevPurchaseRef(),
        idempotencyKey,
        buyerUserId,
        productId: product.id,
        priceCoins: 0n,
        feeCoins: 0n,
        sellerCoins: 0n,
        commissionBps: 0,
        status: "PAID",
      },
    });
    await writeAuditLog({
      actorUserId: buyerUserId,
      action: AuditAction.DEV_PURCHASE_COMPLETED,
      targetType: "DevPurchase",
      targetId: purchase.id,
      metadata: { publicRef: purchase.publicRef, pricing: "FREE" },
      ipAddress: ipAddress ?? null,
    });
    await enqueueWebhookEvent({
      eventType: "order.completed",
      data: { purchaseRef: purchase.publicRef, productSlug: product.slug, pricing: "FREE" },
    }).catch(() => undefined);
    return { ...serializePurchase(purchase), duplicate: false as const };
  }

  const sellerUserId = product.profile?.ownerUserId ?? product.ownerUserId;
  const split = splitCoinPurchase(
    priceCoins,
    developerCommissionBps(Boolean(product.profile?.verified)),
  );
  const ledgerKey = `dev-purchase:${buyerUserId}:${product.id}`;
  let spend: { publicRef: string; duplicate: boolean };
  try {
    spend = await spendCoinsSplit({
      buyerUserId,
      sellerUserId,
      amount: split.priceCoins,
      feeAmount: split.feeCoins,
      sellerAmount: split.sellerCoins,
      memo: `Developer marketplace ${product.publicRef}`,
      idempotencyKey: ledgerKey,
      actorUserId: buyerUserId,
    });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT") {
      throw new DeveloperError("Insufficient KOBA Coins.", "INSUFFICIENT");
    }
    throw error;
  }

  const purchase = await prisma.devPurchase.create({
    data: {
      publicRef: generateDevPurchaseRef(),
      idempotencyKey,
      buyerUserId,
      productId: product.id,
      priceCoins: split.priceCoins,
      feeCoins: split.feeCoins,
      sellerCoins: split.sellerCoins,
      commissionBps: developerCommissionBps(Boolean(product.profile?.verified)),
      status: "PAID",
      captureTxRef: spend.publicRef,
      sellerTxRef: spend.publicRef,
    },
  });
  await prisma.devEntitlement.upsert({
    where: { userId_productId: { userId: buyerUserId, productId: product.id } },
    create: { userId: buyerUserId, productId: product.id, source: "PURCHASE" },
    update: { revokedAt: null, source: "PURCHASE" },
  });
  await prisma.devInstall.upsert({
    where: { productId_userId: { productId: product.id, userId: buyerUserId } },
    create: { productId: product.id, userId: buyerUserId },
    update: { revokedAt: null },
  });
  await writeAuditLog({
    actorUserId: buyerUserId,
    action: AuditAction.DEV_PURCHASE_COMPLETED,
    targetType: "DevPurchase",
    targetId: purchase.id,
    metadata: {
      publicRef: purchase.publicRef,
      priceCoins: split.priceCoins.toString(),
      feeCoins: split.feeCoins.toString(),
    },
    ipAddress: ipAddress ?? null,
  });
  await enqueueWebhookEvent({
    eventType: "order.completed",
    data: {
      purchaseRef: purchase.publicRef,
      productSlug: product.slug,
      priceCoins: split.priceCoins.toString(),
    },
  }).catch(() => undefined);
  return { ...serializePurchase(purchase), duplicate: spend.duplicate };
}

export async function listBuyerPurchases(userId: string) {
  const rows = await prisma.devPurchase.findMany({
    where: { buyerUserId: userId },
    include: { product: { select: { slug: true, name: true, publicRef: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    ...serializePurchase(row),
    productSlug: row.product.slug,
    productName: row.product.name,
    productRef: row.product.publicRef,
  }));
}

export async function listBuyerEntitlements(userId: string) {
  const rows = await prisma.devEntitlement.findMany({
    where: { userId, revokedAt: null },
    include: {
      product: {
        select: {
          slug: true,
          name: true,
          publicRef: true,
          reviewState: true,
          suspendedAt: true,
          kobaOfficial: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    productSlug: row.product.slug,
    productName: row.product.name,
    productRef: row.product.publicRef,
    source: row.source,
    suspended: Boolean(row.product.suspendedAt),
    kobaOfficial: row.product.kobaOfficial,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function refundDeveloperPurchase(
  staffUserId: string,
  purchaseRef: string,
  reason: string,
  ipAddress?: string | null,
) {
  const types = await loadActorTypes(staffUserId);
  if (!canStaffRefund(types)) {
    throw new DeveloperError("Staff refund permission required.", "FORBIDDEN");
  }
  if (!reason.trim()) throw new DeveloperError("Refund reason is required.", "INVALID");

  const purchase = await prisma.devPurchase.findUnique({
    where: { publicRef: purchaseRef },
    include: { product: true },
  });
  if (!purchase) throw new DeveloperError("Purchase not found.", "NOT_FOUND");
  if (purchase.status === "REFUNDED") {
    return { ...serializePurchase(purchase), duplicate: true as const };
  }
  if (purchase.priceCoins <= 0n || !purchase.captureTxRef) {
    await prisma.devPurchase.update({
      where: { id: purchase.id },
      data: { status: "REFUNDED", refundReason: reason.trim() },
    });
    await prisma.devEntitlement.updateMany({
      where: { userId: purchase.buyerUserId, productId: purchase.productId },
      data: { revokedAt: new Date() },
    });
    return {
      ...serializePurchase({ ...purchase, status: "REFUNDED", refundReason: reason.trim() }),
    };
  }

  const sellerWallet = await prisma.coinWallet.findUnique({
    where: { userId: purchase.product.ownerUserId },
  });
  const canReverseSeller = (sellerWallet?.earnedBalance ?? 0n) >= purchase.sellerCoins;
  let refundTxRef: string | null = null;
  let proceedsUnrecoverable = false;

  if (canReverseSeller) {
    const reversed = await reverseTransaction({
      userId: purchase.buyerUserId,
      publicRef: purchase.captureTxRef,
      idempotencyKey: `dev-refund:${purchase.publicRef}`,
      reason,
      actorUserId: staffUserId,
      ipAddress: ipAddress ?? null,
    });
    refundTxRef = reversed.publicRef;
    if (purchase.sellerCoins > 0n) {
      await prisma.coinWallet.updateMany({
        where: {
          userId: purchase.product.ownerUserId,
          earnedBalance: { gte: purchase.sellerCoins },
        },
        data: { earnedBalance: { decrement: purchase.sellerCoins } },
      });
    }
  } else {
    const staffType = types.find((type) => type === "SUPERADMIN" || type === "ADMIN") ?? "ADMIN";
    const credited = await staffAdjustCoins({
      targetUserId: purchase.buyerUserId,
      amount: purchase.priceCoins,
      bucket: "PURCHASED",
      direction: "credit",
      reason: `Developer marketplace refund ${purchase.publicRef}: ${reason.trim()}`,
      idempotencyKey: `dev-refund-platform:${purchase.publicRef}`,
      staffUserId,
      staffAccountType: staffType,
      ipAddress: ipAddress ?? null,
    });
    refundTxRef = credited.publicRef;
    proceedsUnrecoverable = true;
  }

  const updated = await prisma.devPurchase.update({
    where: { id: purchase.id },
    data: {
      status: "REFUNDED",
      refundReason: reason.trim(),
      refundTxRef,
      proceedsUnrecoverable,
    },
  });
  await prisma.devEntitlement.updateMany({
    where: { userId: purchase.buyerUserId, productId: purchase.productId },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: staffUserId,
    action: AuditAction.DEV_PURCHASE_REFUNDED,
    targetType: "DevPurchase",
    targetId: purchase.id,
    metadata: {
      publicRef: purchase.publicRef,
      reason: reason.trim(),
      proceedsUnrecoverable,
    },
    ipAddress: ipAddress ?? null,
  });
  await enqueueWebhookEvent({
    eventType: "order.refunded",
    data: { purchaseRef: purchase.publicRef, productSlug: purchase.product.slug },
  }).catch(() => undefined);
  return serializePurchase(updated);
}
