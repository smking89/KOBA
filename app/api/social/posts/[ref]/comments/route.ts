import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { createCommentSchema } from "@/features/social/schemas/social.schemas";
import { addComment } from "@/features/social/services/post.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await addComment(session.user.id, ref, parsed.data.body), {
      status: 201,
    });
  } catch (error) {
    return jsonSocialError(error, "Could not comment.");
  }
}
