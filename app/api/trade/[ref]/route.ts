import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { getTradeByRef } from "@/features/trade/services/trade.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`trade-get:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many trade requests." },
      { status: 429, headers: noStore },
    );
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await getTradeByRef(session.user.id, ref), { headers: noStore });
  } catch (error) {
    return jsonTradeError(error, "Could not load trade.");
  }
}
