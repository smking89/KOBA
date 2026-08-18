import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import {
  getPluginKeyStatus,
  rotatePluginApiKey,
} from "@/features/servers/services/plugin-gateway.service";

export async function GET(_request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { serverId } = await context.params;
  try {
    const status = await getPluginKeyStatus(session.user.id, serverId);
    return NextResponse.json(status);
  } catch (error) {
    return jsonServerError(error, "Could not load plugin key status.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`plugin-key-rotate:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many rotation attempts." }, { status: 429 });
  }
  const { serverId } = await context.params;
  try {
    const result = await rotatePluginApiKey(session.user.id, serverId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonServerError(error, "Could not rotate the plugin API key.");
  }
}
