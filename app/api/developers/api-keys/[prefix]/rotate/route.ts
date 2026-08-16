import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { rotateDeveloperApiKey } from "@/features/developers/services/portal.service";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ prefix: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const { prefix } = await context.params;
  try {
    return jsonDeveloper(await rotateDeveloperApiKey(userId, prefix));
  } catch (err) {
    return jsonDeveloperError(err, "Could not rotate API key.");
  }
}
