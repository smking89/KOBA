import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonDeveloperError } from "@/features/developers/lib/http";
import { submitForReview } from "@/features/developers/services/developer.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ ref: string }> },
) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`dev-submit:${session.user.id}`, 15, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many submit attempts." }, { status: 429 });
  }
  const { ref } = await context.params;
  try {
    const product = await submitForReview(session.user.id, ref, clientIp(request));
    return NextResponse.json(product);
  } catch (error) {
    return jsonDeveloperError(error, "Could not submit product.");
  }
}
