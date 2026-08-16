import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import {
  clearActiveMap,
  listMyOwnedMaps,
  setActiveMap,
} from "@/features/servers/services/server.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const maps = await listMyOwnedMaps(session.user.id);
  return NextResponse.json({ maps });
}

const setActiveMapSchema = z.object({
  inventoryItemPublicRef: z.string().trim().min(1).max(64),
});

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`server-active-map:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }
  const { serverId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = setActiveMapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const server = await setActiveMap(
      session.user.id,
      serverId,
      parsed.data.inventoryItemPublicRef,
      clientIp(request),
    );
    return NextResponse.json(server);
  } catch (error) {
    return jsonServerError(error, "Could not set active map.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ serverId: string }> },
) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { serverId } = await context.params;
  try {
    const server = await clearActiveMap(session.user.id, serverId);
    return NextResponse.json(server);
  } catch (error) {
    return jsonServerError(error, "Could not clear active map.");
  }
}
