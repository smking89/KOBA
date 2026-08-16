import { NextResponse } from "next/server";
import { jsonDeveloperError } from "@/features/developers/lib/http";
import { signArtifactDownload } from "@/features/developers/services/developer.service";
import { requireDeveloperSession } from "@/features/developers/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ versionRef: string }> }) {
  const session = await requireDeveloperSession();
  if (!session.ok) return session.response;
  const { userId } = session;
  const { versionRef } = await context.params;
  try {
    const result = await signArtifactDownload(userId, versionRef);
    if (result.mode === "redirect") {
      return NextResponse.redirect(result.url, { headers: { "Cache-Control": "no-store" } });
    }
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": result.mime,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    return jsonDeveloperError(err, "Could not download artifact.");
  }
}
