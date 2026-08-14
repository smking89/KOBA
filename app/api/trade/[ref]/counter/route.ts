import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { counterTradeSchema } from "@/features/trade/schemas/trade.schemas";
import { counterTrade } from "@/features/trade/services/trade.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`trade-counter:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many counter attempts." },
      { status: 429, headers: noStore },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }
  const parsed = counterTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid counter payload." },
      { status: 400, headers: noStore },
    );
  }
  const { ref } = await context.params;
  try {
    const trade = await counterTrade(session.user.id, ref, parsed.data, clientIp(request));
    return NextResponse.json(trade, { status: 201, headers: noStore });
  } catch (error) {
    return jsonTradeError(error, "Could not counter trade.");
  }
}
