import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonSocialError } from "@/features/social/lib/http";
import { createStorySchema } from "@/features/social/schemas/social.schemas";
import { createStory } from "@/features/social/services/post.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to post a story." }, { status: 401 });
  }
  const limited = rateLimit(`story:${session.user.id}`, 12, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many stories." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid story." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createStory(session.user.id, parsed.data), { status: 201 });
  } catch (error) {
    return jsonSocialError(error, "Could not create story.");
  }
}
