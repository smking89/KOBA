import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { updateDeveloperSocialsSchema } from "@/features/developers/schemas/developer.schemas";
import { updateDeveloperSocials } from "@/features/developers/services/portal.service";
import {
  limitDeveloper,
  readJsonBody,
  requireDeveloperSession,
} from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-socials:${userId}`, 10);
  if (limited) return limited;
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) return parsedBody.error;
  const parsed = updateDeveloperSocialsSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDeveloper({ error: "Invalid social links." }, 400);
  try {
    const profile = await updateDeveloperSocials(userId, parsed.data);
    return jsonDeveloper(profile);
  } catch (err) {
    return jsonDeveloperError(err, "Could not update socials.");
  }
}
