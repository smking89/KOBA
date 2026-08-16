import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import {
  createServerSchema,
  directoryQuerySchema,
} from "@/features/servers/schemas/server.schemas";
import { createServer, listDirectory } from "@/features/servers/services/server.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const parsed = directoryQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid directory query." }, { status: 400 });
  }
  try {
    const result = await listDirectory(parsed.data, session?.user.id ?? null);
    return NextResponse.json(result);
  } catch (error) {
    return jsonServerError(error, "Could not load servers.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`server-create:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many server create attempts." },
      { status: 429, headers: noStore },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid server details." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const server = await createServer(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(server, { status: 201, headers: noStore });
  } catch (error) {
    return jsonServerError(error, "Could not create server.");
  }
}
