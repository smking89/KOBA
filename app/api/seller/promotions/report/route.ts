import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { recordPromotionEvent } from "@/features/promotions/services/events.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignId: z.string().trim().min(8).max(64),
  reason: z.string().trim().min(8).max(500),
});

export async function POST(request: Request) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-report:${session.userId}`, 10);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = schema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid report." }, 400);
  try {
    await recordPromotionEvent({
      type: "campaign.reported",
      campaignId: parsed.data.campaignId,
      actorUserId: session.userId,
      payload: { reason: parsed.data.reason },
      idempotencyKey: `report:${session.userId}:${parsed.data.campaignId}:${Date.now()}`,
    });
    return jsonPromotion({ ok: true });
  } catch (error) {
    return jsonPromotionError(error, "Could not submit report.");
  }
}
