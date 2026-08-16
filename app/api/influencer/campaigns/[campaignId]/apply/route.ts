import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { participationActionSchema } from "@/features/promotions/schemas/promotions.schemas";
import { applyToCampaign } from "@/features/promotions/services/participation.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`inf-apply:${session.userId}`, 20);
  if (limited) return limited;
  const { campaignId } = await context.params;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = participationActionSchema.safeParse(parsedBody.body ?? { action: "apply" });
  if (!parsed.success) return jsonPromotion({ error: "Invalid request." }, 400);
  try {
    const participation = await applyToCampaign(
      session.userId,
      campaignId,
      Boolean(parsed.data.acceptTerms),
    );
    return jsonPromotion({ participation }, 201);
  } catch (error) {
    return jsonPromotionError(error, "Could not apply to campaign.");
  }
}
