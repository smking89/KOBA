import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { reportSchema } from "@/features/social/schemas/social.schemas";
import { createReport } from "@/features/social/services/post.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to report." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createReport(session.user.id, parsed.data), { status: 201 });
  } catch (error) {
    return jsonSocialError(error, "Could not file report.");
  }
}
