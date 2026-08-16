import type { PromoPayoutType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ShopError } from "@/features/shops/services/shop.service";
import type { PromoConfigUpdateInput } from "@/features/shops/schemas/shop.schemas";

/**
 * payoutValue is basis points (0-10000 == 0%-100%) for PERCENT_BPS, cents for
 * FIXED_CENTS (only non-negative, no fixed upper bound).
 */
export function isValidPromoPayoutValue(payoutType: PromoPayoutType, payoutValue: number): boolean {
  if (!Number.isInteger(payoutValue) || payoutValue < 0) {
    return false;
  }
  if (payoutType === "PERCENT_BPS") {
    return payoutValue <= 10000;
  }
  return true;
}

export async function getPromoConfig(userId: string) {
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new ShopError("Create a shop first.", "NOT_FOUND");
  }
  return prisma.shopPromoConfig.findUnique({ where: { shopId: shop.id } });
}

export async function updatePromoConfig(userId: string, input: PromoConfigUpdateInput) {
  const shop = await prisma.shop.findUnique({ where: { ownerUserId: userId } });
  if (!shop) {
    throw new ShopError("Create a shop first.", "NOT_FOUND");
  }

  const existing = await prisma.shopPromoConfig.findUnique({ where: { shopId: shop.id } });
  const payoutType = input.payoutType ?? existing?.payoutType ?? "PERCENT_BPS";
  const payoutValue = input.payoutValue ?? existing?.payoutValue ?? 0;

  if (!isValidPromoPayoutValue(payoutType, payoutValue)) {
    throw new ShopError(
      "payoutValue is out of range for the chosen payoutType.",
      "INVALID_PAYOUT_VALUE",
    );
  }

  return prisma.shopPromoConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      influencerEligible: input.influencerEligible ?? false,
      payoutType,
      payoutValue,
    },
    update: {
      influencerEligible: input.influencerEligible ?? existing?.influencerEligible ?? false,
      payoutType,
      payoutValue,
    },
  });
}
