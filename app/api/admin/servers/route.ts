import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonServerError } from "@/features/servers/lib/http";
import { listPendingServers } from "@/features/servers/services/server.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`admin-servers:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many admin server requests." },
      { status: 429, headers: noStore },
    );
  }
  try {
    return NextResponse.json(
      { items: await listPendingServers(session.user.id) },
      { headers: noStore },
    );
  } catch (error) {
    return jsonServerError(error, "Could not load pending servers.");
  }
}
