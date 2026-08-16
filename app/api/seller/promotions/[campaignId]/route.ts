import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { campaignActionSchema } from "@/features/promotions/schemas/promotions.schemas";
import {
  getSellerCampaign,
  transitionSellerCampaign,
} from "@/features/promotions/services/campaign.service";
import type { AffiliateCampaignStatus } from "@/features/promotions/lib/campaign-state";

export const dynamic = "force-dynamic";

const MAP: Record<string, AffiliateCampaignStatus> = {
  submit: "SUBMITTED",
  activate: "ACTIVE",
  pause: "PAUSED",
  complete: "COMPLETED",
  cancel: "CANCELLED",
};

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const { campaignId } = await context.params;
  try {
    return jsonPromotion({ campaign: await getSellerCampaign(session.userId, campaignId) });
  } catch (error) {
    return jsonPromotionError(error, "Could not load campaign.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-campaign-act:${session.userId}`, 30);
  if (limited) return limited;
  const { campaignId } = await context.params;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = campaignActionSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid action." }, 400);
  const next = MAP[parsed.data.action];
  if (!next) return jsonPromotion({ error: "Unsupported action." }, 400);
  try {
    const campaign = await transitionSellerCampaign(session.userId, campaignId, next);
    return jsonPromotion({ campaign });
  } catch (error) {
    return jsonPromotionError(error, "Could not update campaign.");
  }
}
