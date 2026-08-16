import { jsonInfluencer, jsonInfluencerError } from "@/features/influencer/lib/http";
import { clientIp } from "@/lib/http/client-ip";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { updateShopPromoSchema } from "@/features/influencer/schemas/influencer.schemas";
import { getShopPromo, updateShopPromo } from "@/features/influencer/services/influencer.service";
import { readJsonBody } from "@/features/influencer/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return jsonInfluencer({ error: "Unauthorized." }, 401);
  try {
    return jsonInfluencer({ promo: await getShopPromo(session.user.id) });
  } catch (error) {
    return jsonInfluencerError(error, "Could not load promo settings.");
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user.id) return jsonInfluencer({ error: "Unauthorized." }, 401);
  const limited = await rateLimit(`shop-promo:${session.user.id}`, 12, 15 * 60 * 1000);
  if (!limited.success) return jsonInfluencer({ error: "Too many attempts." }, 429);
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = updateShopPromoSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonInfluencer({ error: "Invalid promo terms." }, 400);
  try {
    return jsonInfluencer({
      promo: await updateShopPromo(session.user.id, parsed.data, clientIp(request)),
    });
  } catch (error) {
    return jsonInfluencerError(error, "Could not update promo terms.");
  }
}
