import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonSocialError } from "@/features/social/lib/http";
import { createPostSchema } from "@/features/social/schemas/social.schemas";
import { createPost } from "@/features/social/services/post.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to post." }, { status: 401 });
  }
  const limited = rateLimit(`post:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many posts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post." }, { status: 400 });
  }
  try {
    const post = await createPost(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return jsonSocialError(error, "Could not create post.");
  }
}
