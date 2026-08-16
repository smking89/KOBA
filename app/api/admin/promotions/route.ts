import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { auth } from "@/lib/auth";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { canStaffModeratePromotions } from "@/features/promotions/lib/access";
import { listStaffPromotionQueue } from "@/features/promotions/services/moderation.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return jsonPromotion({ error: "Unauthorized." }, 401);
  const snapshot = await getAccountSnapshot(session.user.id);
  if (!snapshot || !canStaffModeratePromotions(snapshot.identities.map((row) => row.accountType))) {
    return jsonPromotion({ error: "Forbidden." }, 403);
  }
  try {
    return jsonPromotion(await listStaffPromotionQueue());
  } catch (error) {
    return jsonPromotionError(error, "Could not load promotion queue.");
  }
}
