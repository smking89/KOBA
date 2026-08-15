import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { rotateWebhookSecret } from "@/features/developers/services/webhook.service";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const { ref } = await context.params;
  try {
    return jsonDeveloper(await rotateWebhookSecret(userId, ref));
  } catch (err) {
    return jsonDeveloperError(err, "Could not rotate webhook secret.");
  }
}
