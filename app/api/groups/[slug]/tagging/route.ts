import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { setGroupTagging } from "@/features/social/services/profile.service";
import { z } from "zod";

const schema = z.object({ allowed: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const { slug } = await context.params;
  try {
    return NextResponse.json(await setGroupTagging(session.user.id, slug, parsed.data.allowed));
  } catch (error) {
    return jsonSocialError(error, "Could not update tagging.");
  }
}
