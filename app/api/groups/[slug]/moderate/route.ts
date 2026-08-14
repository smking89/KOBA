import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonGroupError } from "@/features/groups/lib/http";
import { groupModerateSchema } from "@/features/groups/schemas/group.schemas";
import { moderateGroup } from "@/features/groups/services/group.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`group-mod:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many moderation attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = groupModerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid moderation payload." }, { status: 400 });
  }
  const { slug } = await context.params;
  try {
    const result = await moderateGroup(session.user.id, slug, parsed.data, clientIp(request));
    return NextResponse.json(result);
  } catch (error) {
    return jsonGroupError(error, "Could not moderate group.");
  }
}
