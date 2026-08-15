import { jsonPromotion, jsonPromotionError } from "@/features/promotions/lib/http";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { readJsonBody } from "@/features/promotions/lib/session";
import { billSponsoredClick } from "@/features/promotions/services/ads.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignId: z.string().trim().min(8).max(64),
});

export async function POST(request: Request) {
  const session = await auth();
  const ip = clientIp(request);
  const limited = await rateLimit(`ad-click:${session?.user.id ?? ip ?? "anon"}`, 40, 60_000);
  if (!limited.success) return jsonPromotion({ error: "Too many clicks." }, 429);
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = schema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonPromotion({ error: "Invalid click." }, 400);
  try {
    const result = await billSponsoredClick({
      campaignId: parsed.data.campaignId,
      viewerUserId: session?.user.id ?? null,
      ip,
    });
    return jsonPromotion(result);
  } catch (error) {
    return jsonPromotionError(error, "Could not record click.");
  }
}
