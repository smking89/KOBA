import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { createLfgSchema } from "@/features/lfg/schemas/lfg.schemas";
import { createLfgPost } from "@/features/lfg/services/lfg.service";
import { jsonLfgError } from "@/features/lfg/lib/http";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to post LFG." }, { status: 401 });
  }
  const limited = await rateLimit(`lfg-create:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many LFG posts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createLfgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid LFG details." }, { status: 400 });
  }
  try {
    const post = await createLfgPost(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return jsonLfgError(error, "Could not create LFG post.");
  }
}
