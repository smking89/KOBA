import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { staffServerActionSchema } from "@/features/servers/schemas/server.schemas";
import { staffModerateServer } from "@/features/servers/services/server.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`admin-server-mod:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many moderation attempts." },
      { status: 429, headers: noStore },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }
  const parsed = staffServerActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff action." }, { status: 400, headers: noStore });
  }
  const { serverId } = await context.params;
  try {
    const server = await staffModerateServer(
      session.user.id,
      serverId,
      parsed.data,
      clientIp(request),
    );
    return NextResponse.json(server, { headers: noStore });
  } catch (error) {
    return jsonServerError(error, "Could not moderate server.");
  }
}
