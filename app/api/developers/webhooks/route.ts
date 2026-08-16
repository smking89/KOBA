import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { createWebhookSchema } from "@/features/developers/schemas/developer.schemas";
import {
  createWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "@/features/developers/services/webhook.service";
import {
  limitDeveloper,
  readJsonBody,
  requireDeveloperSession,
} from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  try {
    return jsonDeveloper({
      items: await listWebhookEndpoints(userId),
      deliveries: await listWebhookDeliveries(userId),
    });
  } catch (err) {
    return jsonDeveloperError(err, "Could not load webhooks.");
  }
}

export async function POST(request: Request) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-webhook:${userId}`, 10);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createWebhookSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid webhook details." }, 400);
  try {
    return jsonDeveloper(await createWebhookEndpoint(userId, parsed.data), 201);
  } catch (err) {
    return jsonDeveloperError(err, "Could not create webhook.");
  }
}
