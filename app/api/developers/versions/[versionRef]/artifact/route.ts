import { jsonDeveloper, jsonDeveloperError } from "@/features/developers/lib/http";
import { attachArtifact } from "@/features/developers/services/developer.service";
import { DEV_MAX_ARTIFACT_BYTES } from "@/features/developers/lib/artifacts";
import { limitDeveloper, requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ versionRef: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const limited = await limitDeveloper(`dev-artifact:${userId}`, 12);
  if (limited) return limited;
  const { versionRef } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return jsonDeveloper({ error: "Artifact file is required." }, 400);
  }
  if (file.size > DEV_MAX_ARTIFACT_BYTES) {
    return jsonDeveloper({ error: "Artifact exceeds the size limit." }, 400);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const artifact = await attachArtifact(userId, versionRef, {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      bytes,
    });
    return jsonDeveloper(
      {
        filename: artifact.filename,
        sha256: artifact.sha256,
        byteSize: artifact.byteSize,
        status: artifact.status,
      },
      201,
    );
  } catch (err) {
    return jsonDeveloperError(err, "Could not attach artifact.");
  }
}
