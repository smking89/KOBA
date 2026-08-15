import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { participationActionSchema } from "@/features/promotions/schemas/promotions.schemas";
import { influencerRespond } from "@/features/promotions/services/participation.service";
import type { CampaignParticipationStatus } from "@/features/promotions/lib/campaign-state";

export const dynamic = "force-dynamic";

const MAP: Record<string, CampaignParticipationStatus> = {
  accept: "ACTIVE",
  reject: "REJECTED",
  pause: "PAUSED",
  resume: "ACTIVE",
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`inf-part:${session.userId}`, 30);
  if (limited) return limited;
  const { id } = await context.params;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = participationActionSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid request." }, 400);
  const next = MAP[parsed.data.action];
  if (!next) return jsonPromotion({ error: "Unsupported action." }, 400);
  try {
    const participation = await influencerRespond(
      session.userId,
      id,
      next,
      parsed.data.acceptTerms,
    );
    return jsonPromotion({ participation });
  } catch (error) {
    return jsonPromotionError(error, "Could not update participation.");
  }
}
