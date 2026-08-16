import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { redeliverWebhook } from "@/features/developers/services/webhook.service";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const { deliveryId } = await context.params;
  try {
    return jsonDeveloper(await redeliverWebhook(userId, deliveryId));
  } catch (err) {
    return jsonDeveloperError(err, "Could not redeliver webhook.");
  }
}
