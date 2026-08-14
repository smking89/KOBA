import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { viewStory } from "@/features/social/services/post.service";

export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to view stories." }, { status: 401 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await viewStory(session.user.id, ref));
  } catch (error) {
    return jsonSocialError(error, "Could not open story.");
  }
}
