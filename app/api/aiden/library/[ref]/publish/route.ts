import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonAidenError } from "@/features/aiden/lib/http";
import { assertAidenBusinessAccess } from "@/features/aiden/lib/require-business";
import { publishAidenAssetSchema } from "@/features/aiden/schemas/aiden.schemas";
import { publishAssetToMarketplace } from "@/features/aiden/services/aiden.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`aiden-publish:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many publish attempts." }, { status: 429 });
  }
  const { ref } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = publishAidenAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid publish request." }, { status: 400 });
  }

  try {
    await assertAidenBusinessAccess(session.user.id);
    const asset = await publishAssetToMarketplace(
      session.user.id,
      ref,
      parsed.data,
      clientIp(request),
    );
    return NextResponse.json(asset);
  } catch (error) {
    return jsonAidenError(error, "Could not publish this asset to the marketplace.");
  }
}
