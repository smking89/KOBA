import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { createDeveloperAppSchema } from "@/features/developers/schemas/developer.schemas";
import {
  createDeveloperApplication,
  listDeveloperApplications,
} from "@/features/developers/services/portal.service";
import { clientIp } from "@/lib/http/client-ip";
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
    return jsonDeveloper({ items: await listDeveloperApplications(userId) });
  } catch (err) {
    return jsonDeveloperError(err, "Could not load applications.");
  }
}

export async function POST(request: Request) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-app:${userId}`, 12);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createDeveloperAppSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid application details." }, 400);
  try {
    return jsonDeveloper(
      await createDeveloperApplication(userId, parsed.data, clientIp(request)),
      201,
    );
  } catch (err) {
    return jsonDeveloperError(err, "Could not create application.");
  }
}
