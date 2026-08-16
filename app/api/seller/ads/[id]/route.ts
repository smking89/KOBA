import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { sponsoredActionSchema } from "@/features/promotions/schemas/promotions.schemas";
import {
  activateApprovedAd,
  cancelOrCompleteAd,
  submitSponsoredCampaign,
} from "@/features/promotions/services/ads.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-ad-act:${session.userId}`, 20);
  if (limited) return limited;
  const { id } = await context.params;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = sponsoredActionSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid action." }, 400);
  try {
    if (parsed.data.action === "submit") {
      return jsonPromotion({ campaign: await submitSponsoredCampaign(session.userId, id) });
    }
    if (parsed.data.action === "activate") {
      return jsonPromotion({ campaign: await activateApprovedAd(session.userId, id) });
    }
    const next =
      parsed.data.action === "pause"
        ? "PAUSED"
        : parsed.data.action === "complete"
          ? "COMPLETED"
          : "CANCELLED";
    return jsonPromotion({ campaign: await cancelOrCompleteAd(session.userId, id, next) });
  } catch (error) {
    return jsonPromotionError(error, "Could not update ad campaign.");
  }
}
