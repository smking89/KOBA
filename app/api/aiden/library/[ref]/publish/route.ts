import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAiden, jsonAidenError } from "@/features/aiden/lib/http";
import { publishAidenAssetSchema } from "@/features/aiden/schemas/aiden.schemas";
import {
  publishAssetToMarketplace,
  publishToShopRequest,
} from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`aiden-publish:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonAiden({ error: "Too many publish attempts." }, 429);
  }
  const { ref } = await context.params;

  const raw = await request.text();
  let body: unknown = null;
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonAiden({ error: "Invalid JSON body." }, 400);
    }
  }

  try {
    if (body == null) {
      const asset = await publishToShopRequest(session.user.id, ref);
      return jsonAiden(asset);
    }
    const parsed = publishAidenAssetSchema.safeParse(body);
    if (!parsed.success) {
      return jsonAiden({ error: "Invalid publish request." }, 400);
    }
    const asset = await publishAssetToMarketplace(
      session.user.id,
      ref,
      parsed.data,
      clientIp(request),
    );
    return jsonAiden(asset);
  } catch (error) {
    return jsonAidenError(error, "Could not publish this asset to the marketplace.");
  }
}
