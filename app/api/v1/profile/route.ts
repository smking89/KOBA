import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { requireApiKey } from "@/features/developers/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = await requireApiKey(request, "profile:read");
    return jsonDeveloper({
      environment: key.environment,
      profile: {
        slug: key.application.profile.slug,
        displayName: key.application.profile.displayName,
        verified: key.application.profile.verified,
      },
    });
  } catch (error) {
    return jsonDeveloperError(error, "Could not read profile.");
  }
}
