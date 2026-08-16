import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { purchaseSchema } from "@/features/developers/schemas/developer.schemas";
import { purchaseProduct } from "@/features/developers/services/purchase.service";
import { clientIp } from "@/lib/http/client-ip";
import {
  limitDeveloper,
  readJsonBody,
  requireDeveloperSession,
} from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-buy:${userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = purchaseSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid purchase request." }, 400);
  const { slug } = await context.params;
  try {
    return jsonDeveloper(
      await purchaseProduct(userId, slug, parsed.data.idempotencyKey, clientIp(request)),
      201,
    );
  } catch (err) {
    return jsonDeveloperError(err, "Could not complete purchase.");
  }
}
