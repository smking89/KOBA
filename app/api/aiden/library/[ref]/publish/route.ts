import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAidenError } from "@/features/aiden/lib/http";
import { publishToShopRequest } from "@/features/aiden/services/aiden.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ ref: string }> },
) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`aiden-publish:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many publish attempts." }, { status: 429 });
  }
  const { ref } = await context.params;
  try {
    const asset = await publishToShopRequest(session.user.id, ref);
    return NextResponse.json(asset);
  } catch (error) {
    return jsonAidenError(error, "Could not submit asset for review.");
  }
}
