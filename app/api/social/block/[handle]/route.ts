import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { toggleBlock } from "@/features/social/services/profile.service";

export async function POST(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { handle } = await context.params;
  try {
    return NextResponse.json(await toggleBlock(session.user.id, handle));
  } catch (error) {
    return jsonSocialError(error, "Could not update block.");
  }
}
