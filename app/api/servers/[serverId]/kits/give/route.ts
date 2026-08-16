import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { giveKitSchema } from "@/features/servers/schemas/server.schemas";
import { giveKitToPlayer } from "@/features/servers/services/server.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ serverId: string }> },
) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`server-kit-give:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many kit deliveries." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = giveKitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid kit delivery request." }, { status: 400 });
  }
  const { serverId } = await context.params;
  try {
    const result = await giveKitToPlayer(
      session.user.id,
      serverId,
      parsed.data.kitName,
      parsed.data.gamertag,
      clientIp(request),
    );
    return NextResponse.json(result);
  } catch (error) {
    return jsonServerError(error, "Could not deliver kit.");
  }
}
