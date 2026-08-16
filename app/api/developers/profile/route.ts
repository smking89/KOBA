import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { createDeveloperProfileSchema } from "@/features/developers/schemas/developer.schemas";
import {
  createDeveloperProfile,
  getMyDeveloperProfile,
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
    return jsonDeveloper({ profile: await getMyDeveloperProfile(userId) });
  } catch (err) {
    return jsonDeveloperError(err, "Could not load developer profile.");
  }
}

export async function POST(request: Request) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-profile:${userId}`, 8);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = createDeveloperProfileSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid publisher details." }, 400);
  try {
    const profile = await createDeveloperProfile(userId, parsed.data, clientIp(request));
    return jsonDeveloper(profile, 201);
  } catch (err) {
    return jsonDeveloperError(err, "Could not create developer profile.");
  }
}
