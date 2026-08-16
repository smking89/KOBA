import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { createAffiliateCampaignSchema } from "@/features/promotions/schemas/promotions.schemas";
import {
  createAffiliateCampaign,
  listSellerCampaigns,
} from "@/features/promotions/services/campaign.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    return jsonPromotion({ campaigns: await listSellerCampaigns(session.userId) });
  } catch (error) {
    return jsonPromotionError(error, "Could not load campaigns.");
  }
}

export async function POST(request: Request) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-campaign:${session.userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createAffiliateCampaignSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid campaign." }, 400);
  try {
    const campaign = await createAffiliateCampaign(session.userId, parsed.data, clientIp(request));
    return jsonPromotion({ campaign }, 201);
  } catch (error) {
    return jsonPromotionError(error, "Could not create campaign.");
  }
}
