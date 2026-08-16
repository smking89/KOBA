import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { updateInfluencerProfileSchema } from "@/features/promotions/schemas/promotions.schemas";
import {
  getInfluencerProfile,
  requestInfluencerVerification,
  updateInfluencerProfile,
} from "@/features/promotions/services/profile.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    return jsonPromotion({ profile: await getInfluencerProfile(session.userId) });
  } catch (error) {
    return jsonPromotionError(error, "Could not load influencer profile.");
  }
}

export async function PATCH(request: Request) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`inf-profile:${session.userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = updateInfluencerProfileSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid profile." }, 400);
  try {
    const profile = await updateInfluencerProfile(session.userId, parsed.data, clientIp(request));
    return jsonPromotion({ profile });
  } catch (error) {
    return jsonPromotionError(error, "Could not update profile.");
  }
}

export async function POST() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    const profile = await requestInfluencerVerification(session.userId);
    return jsonPromotion({ profile });
  } catch (error) {
    return jsonPromotionError(error, "Could not request verification.");
  }
}
