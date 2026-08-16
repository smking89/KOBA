import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonDeveloperError } from "@/features/developers/lib/http";
import { revokeInstall } from "@/features/developers/services/developer.service";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`dev-revoke:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many revoke attempts." }, { status: 429 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await revokeInstall(session.user.id, ref));
  } catch (error) {
    return jsonDeveloperError(error, "Could not revoke install.");
  }
}
