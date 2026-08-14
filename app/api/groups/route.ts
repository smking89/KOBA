import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { createGroupSchema } from "@/features/groups/schemas/group.schemas";
import { createGroup } from "@/features/groups/services/group.service";
import { jsonGroupError } from "@/features/groups/lib/http";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to create a group." }, { status: 401 });
  }
  const ip = clientIp(request) ?? "unknown";
  const limited = await rateLimit(`group-create:${session.user.id}`, 8, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many group create attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid group details." }, { status: 400 });
  }
  try {
    const group = await createGroup(session.user.id, parsed.data, ip);
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return jsonGroupError(error, "Could not create group.");
  }
}
