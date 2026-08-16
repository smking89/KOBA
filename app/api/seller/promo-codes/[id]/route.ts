import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, requireSignedIn } from "@/features/promotions/lib/session";
import { suspendPromoCode } from "@/features/promotions/services/promo-code.service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-promo-suspend:${session.userId}`, 20);
  if (limited) return limited;
  const { id } = await context.params;
  try {
    return jsonPromotion({ code: await suspendPromoCode(session.userId, id) });
  } catch (error) {
    return jsonPromotionError(error, "Could not suspend promo code.");
  }
}
