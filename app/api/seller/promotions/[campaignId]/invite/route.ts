import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { inviteInfluencerSchema } from "@/features/promotions/schemas/promotions.schemas";
import { inviteInfluencer } from "@/features/promotions/services/participation.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-invite:${session.userId}`, 30);
  if (limited) return limited;
  const { campaignId } = await context.params;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = inviteInfluencerSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid handle." }, 400);
  try {
    const participation = await inviteInfluencer(session.userId, campaignId, parsed.data.handle);
    return jsonPromotion({ participation }, 201);
  } catch (error) {
    return jsonPromotionError(error, "Could not invite influencer.");
  }
}
