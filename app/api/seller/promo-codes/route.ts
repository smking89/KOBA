import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import { limitPromotion, readJsonBody, requireSignedIn } from "@/features/promotions/lib/session";
import { createPromoCodeSchema } from "@/features/promotions/schemas/promotions.schemas";
import {
  createPromoCode,
  listSellerPromoCodes,
} from "@/features/promotions/services/promo-code.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  try {
    return jsonPromotion({ codes: await listSellerPromoCodes(session.userId) });
  } catch (error) {
    return jsonPromotionError(error, "Could not load promo codes.");
  }
}

export async function POST(request: Request) {
  const session = await requireSignedIn();
  if (!session.ok) return session.response;
  const limited = await limitPromotion(`seller-promo:${session.userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createPromoCodeSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid promo code." }, 400);
  try {
    const code = await createPromoCode(session.userId, parsed.data, clientIp(request));
    return jsonPromotion({ code }, 201);
  } catch (error) {
    return jsonPromotionError(error, "Could not create promo code.");
  }
}
