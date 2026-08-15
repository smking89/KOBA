import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { createVersionSchema } from "@/features/developers/schemas/developer.schemas";
import { createProductVersion } from "@/features/developers/services/developer.service";
import {
  limitDeveloper,
  readJsonBody,
  requireDeveloperSession,
} from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-version:${userId}`, 20);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createVersionSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid version details." }, 400);
  const { ref } = await context.params;
  try {
    return jsonDeveloper(await createProductVersion(userId, ref, parsed.data), 201);
  } catch (err) {
    return jsonDeveloperError(err, "Could not create version.");
  }
}
