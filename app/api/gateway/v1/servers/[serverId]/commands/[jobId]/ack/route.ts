/**
 * Method B plugin ack — HMAC-authenticated. The plugin ran the command
 * locally (inside the game server process) and reports back whether it
 * worked; this is the only place a plugin's own outcome reaches the
 * durable queue's retry state machine (rcon-queue.service#applyJobOutcome).
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import {
  ackPluginCommand,
  authenticatePluginRequest,
} from "@/features/servers/services/plugin-gateway.service";

export const dynamic = "force-dynamic";

const ackSchema = z.object({
  success: z.boolean(),
  error: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ serverId: string; jobId: string }> },
) {
  const { serverId, jobId } = await context.params;
  const limited = await rateLimit(`plugin-gateway-ack:${serverId}`, 120, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const rawBody = await request.text();
  const auth = await authenticatePluginRequest({
    serverIdOrSlug: serverId,
    rawBody,
    signatureHeader: request.headers.get("x-koba-signature"),
  });
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ack payload." }, { status: 400 });
  }

  try {
    await ackPluginCommand(auth.serverId, jobId, {
      success: parsed.data.success,
      ...(parsed.data.error !== undefined ? { error: parsed.data.error } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonServerError(error, "Could not record delivery outcome.");
  }
}
