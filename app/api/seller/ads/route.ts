import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { createSponsoredCampaignSchema } from "@/features/promotions/schemas/promotions.schemas";
import { createSponsoredCampaign, listSellerAds } from "@/features/promotions/services/ads.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    return jsonPromotion({ campaigns: await listSellerAds(session.userId) });
  } catch (error) {
    return jsonPromotionError(error, "Could not load ads.");
  }
}

export async function POST(request: Request) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-ads:${session.userId}`, 15);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createSponsoredCampaignSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid ad campaign." }, 400);
  try {
    const campaign = await createSponsoredCampaign(session.userId, parsed.data, clientIp(request));
    return jsonPromotion({ campaign }, 201);
  } catch (error) {
    return jsonPromotionError(error, "Could not create ad campaign.");
  }
}
