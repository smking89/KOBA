import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { disableWebhookEndpoint } from "@/features/developers/services/webhook.service";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const { ref } = await context.params;
  try {
    return jsonDeveloper(await disableWebhookEndpoint(userId, ref));
  } catch (err) {
    return jsonDeveloperError(err, "Could not disable webhook.");
  }
}
