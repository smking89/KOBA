import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonLfgError } from "@/features/lfg/lib/http";
import { requestLfgSeat } from "@/features/lfg/services/lfg.service";

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to request a seat." }, { status: 401 });
  }
  const limited = rateLimit(`lfg-join:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many LFG requests." }, { status: 429 });
  }
  const { ref } = await context.params;
  try {
    const result = await requestLfgSeat(session.user.id, ref, clientIp(request));
    return NextResponse.json(result);
  } catch (error) {
    return jsonLfgError(error, "Could not request a seat.");
  }
}
