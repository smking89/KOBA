import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonSocialError } from "@/features/social/lib/http";
import { tagPrivacySchema } from "@/features/social/schemas/social.schemas";
import { updateSocialSettings } from "@/features/social/services/profile.service";

export async function POST(request: Request) {
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
  const parsed = tagPrivacySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateSocialSettings(session.user.id, parsed.data));
  } catch (error) {
    return jsonSocialError(error, "Could not save settings.");
  }
}
