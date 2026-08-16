import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { submitForVerification } from "@/features/servers/services/server.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`server-submit:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many submit attempts." },
      { status: 429, headers: noStore },
    );
  }
  const { serverId } = await context.params;
  try {
    const server = await submitForVerification(session.user.id, serverId, clientIp(request));
    return NextResponse.json(server, { headers: noStore });
  } catch (error) {
    return jsonServerError(error, "Could not submit server for verification.");
  }
}
