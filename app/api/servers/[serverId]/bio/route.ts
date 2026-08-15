import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { serverBioSchema } from "@/features/servers/schemas/server.schemas";
import { getServerBio, setServerBio } from "@/features/servers/services/server.service";

export async function GET(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  const { serverId } = await context.params;
  const url = new URL(request.url);
  const forUserId = url.searchParams.get("userId") ?? session?.user.id;
  if (!forUserId) {
    return NextResponse.json({ bio: null });
  }
  try {
    const bio = await getServerBio(forUserId, serverId);
    return NextResponse.json({ bio });
  } catch (error) {
    return jsonServerError(error, "Could not load server bio.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`server-bio:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many bio updates." }, { status: 429 });
  }
  const { serverId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = serverBioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bio." }, { status: 400 });
  }

  try {
    const bio = await setServerBio(session.user.id, serverId, parsed.data.bio);
    return NextResponse.json({ bio });
  } catch (error) {
    return jsonServerError(error, "Could not save server bio.");
  }
}
