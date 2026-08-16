import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { requireSignedIn } from "@/features/promotions/lib/session";
import {
  listInfluencerCommissions,
  totalsByCurrency,
} from "@/features/promotions/services/commission.service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    const commissions = await listInfluencerCommissions(session.userId);
    const clicks = await prisma.referralClickEvent.count({
      where: { participation: { influencerUserId: session.userId } },
    });
    return jsonPromotion({
      commissions,
      totals: totalsByCurrency(commissions),
      clicks,
    });
  } catch (error) {
    return jsonPromotionError(error, "Could not load commissions.");
  }
}
