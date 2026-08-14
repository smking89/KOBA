import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { jsonGroupError } from "@/features/groups/lib/http";
import { leaveGroup } from "@/features/groups/services/group.service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { slug } = await context.params;
  try {
    const result = await leaveGroup(session.user.id, slug, clientIp(request));
    return NextResponse.json(result);
  } catch (error) {
    return jsonGroupError(error, "Could not leave group.");
  }
}
