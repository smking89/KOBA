import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { toggleFavourite } from "@/features/servers/services/server.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(_request: Request, context: { params: Promise<{ serverId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`server-fav:${session.user.id}`, 60, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many favourite attempts." },
      { status: 429, headers: noStore },
    );
  }
  const { serverId } = await context.params;
  try {
    const result = await toggleFavourite(session.user.id, serverId);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    return jsonServerError(error, "Could not update favourite.");
  }
}
