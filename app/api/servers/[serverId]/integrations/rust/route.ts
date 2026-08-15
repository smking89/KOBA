import { NextResponse } from "next/server";
import { rustDisconnectSchema } from "@/features/servers/schemas/integration.schemas";
import {
  disconnectRustIntegration,
  getRustIntegration,
} from "@/features/servers/services/integration.service";
import {
  actorFromSession,
  integrationFail,
  integrationNoStore,
  integrationOk,
  limitIntegration,
  readJson,
  requestIp,
  requireIntegrationSession,
} from "@/features/servers/lib/integration-http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const authz = await requireIntegrationSession();
  if (!authz.ok) return authz.response;
  const session = authz.session;
  const limited = await limitIntegration(session.user.id, "get", 60);
  if (limited) return limited;
  const { serverId } = await context.params;
  const staff = new URL(request.url).searchParams.get("staff") === "1";
  try {
    const health = await getRustIntegration(session.user.id, serverId, {
      staffInspect: staff,
      actor: actorFromSession(session),
    });
    return integrationOk(health);
  } catch (err) {
    return integrationFail(err, "Could not load Rust integration.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const authz = await requireIntegrationSession();
  if (!authz.ok) return authz.response;
  const session = authz.session;
  const limited = await limitIntegration(session.user.id, "disconnect", 20);
  if (limited) return limited;
  const parsed = await readJson(request, rustDisconnectSchema);
  if (!parsed.ok) return parsed.response;
  const { serverId } = await context.params;
  try {
    const result = await disconnectRustIntegration(
      session.user.id,
      serverId,
      parsed.data,
      requestIp(request),
      actorFromSession(session),
    );
    return integrationOk(result);
  } catch (err) {
    return integrationFail(err, "Could not disconnect Rust integration.");
  }
}

export function POST() {
  return NextResponse.json(
    { error: "Use /connect, /test, /rotate, or /refresh." },
    { status: 405, headers: integrationNoStore },
  );
}
