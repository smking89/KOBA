import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonGroupError } from "@/features/groups/lib/http";
import { joinGroup } from "@/features/groups/services/group.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to join a group." }, { status: 401 });
  }
  const limited = rateLimit(`group-join:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many join attempts." }, { status: 429 });
  }
  const { slug } = await context.params;
  try {
    const result = await joinGroup(session.user.id, slug, clientIp(request));
    return NextResponse.json(result);
  } catch (error) {
    return jsonGroupError(error, "Could not join group.");
  }
}
