import { prisma } from "@/lib/db";
import { qualifyDueCommissions } from "@/features/promotions/services/commission.service";
import { settleCompletedAds } from "@/features/promotions/services/ads.service";

export async function runPromotionsWorker(limit = 50) {
  const now = new Date();
  const qualified = await qualifyDueCommissions(limit);
  const settled = await settleCompletedAds(limit);

  const ending = await prisma.affiliateCampaign.updateMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    data: { status: "COMPLETED" },
  });

  const expiredHashes = await prisma.referralClickEvent.updateMany({
    where: { expiresAt: { lte: now }, visitorHash: { not: null } },
    data: { visitorHash: null },
  });

  return {
    qualified: qualified.length,
    adsSettled: settled,
    campaignsCompleted: ending.count,
    hashesCleared: expiredHashes.count,
  };
}
