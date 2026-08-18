/**
 * Method B plugin poll — HMAC-authenticated, called by a game server's
 * own plugin process, never a browser session. Client, 2026-08-18:
 * "A secure, authenticated API endpoint hosted by KOBA that handles
 * incoming requests from game server plugins."
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  authenticatePluginRequest,
  listPendingCommandsForServer,
} from "@/features/servers/services/plugin-gateway.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await context.params;
  const limited = await rateLimit(`plugin-gateway-poll:${serverId}`, 120, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const rawBody = await request.text(); // GET, no body — signed over "" for a consistent scheme with the ack POST
  const auth = await authenticatePluginRequest({
    serverIdOrSlug: serverId,
    rawBody,
    signatureHeader: request.headers.get("x-koba-signature"),
  });
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const commands = await listPendingCommandsForServer(auth.serverId);
  return NextResponse.json({ commands });
}
