import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { createServerSchema } from "@/features/servers/schemas/server.schemas";
import { createServer, listDirectory } from "@/features/servers/services/server.service";

export async function GET() {
  try {
    return NextResponse.json({ items: await listDirectory() });
  } catch (error) {
    return jsonServerError(error, "Could not load servers.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`server-create:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many server create attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid server details." }, { status: 400 });
  }
  try {
    const server = await createServer(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    return jsonServerError(error, "Could not create server.");
  }
}
