import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { getDeveloperApplication } from "@/features/developers/services/portal.service";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const { appId } = await context.params;
  try {
    return jsonDeveloper(await getDeveloperApplication(userId, appId));
  } catch (err) {
    return jsonDeveloperError(err, "Could not load application.");
  }
}
