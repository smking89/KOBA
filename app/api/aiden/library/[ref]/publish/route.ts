import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAiden, jsonAidenError } from "@/features/aiden/lib/http";
import { publishToShopRequest } from "@/features/aiden/services/aiden.service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return jsonAiden({ error: "Unauthorized." }, 401);
  }
  const limited = await rateLimit(`aiden-publish:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return jsonAiden({ error: "Too many review submissions." }, 429);
  }
  const { ref } = await context.params;
  try {
    const asset = await publishToShopRequest(session.user.id, ref);
    return jsonAiden(asset);
  } catch (error) {
    return jsonAidenError(error, "Could not submit asset for review.");
  }
}
