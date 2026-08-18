import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAccessTokens } from "@/features/oauth-device/services/device-flow.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const tokens = await listAccessTokens(session.user.id);
  return NextResponse.json({ tokens });
}
