import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { jsonLfgError } from "@/features/lfg/lib/http";
import { lfgModerateSchema } from "@/features/lfg/schemas/lfg.schemas";
import { moderateLfgPost } from "@/features/lfg/services/lfg.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = lfgModerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid moderation payload." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    const result = await moderateLfgPost(session.user.id, ref, parsed.data, clientIp(request));
    return NextResponse.json(result);
  } catch (error) {
    return jsonLfgError(error, "Could not update LFG post.");
  }
}
