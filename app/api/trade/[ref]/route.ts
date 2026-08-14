import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { transitionTradeSchema } from "@/features/trade/schemas/trade.schemas";
import { getTradeByRef, transitionTrade } from "@/features/trade/services/trade.service";

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { ref } = await context.params;
  try {
    return NextResponse.json(await getTradeByRef(session.user.id, ref));
  } catch (error) {
    return jsonTradeError(error, "Could not load trade.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`trade-transition:${session.user.id}`, 40, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many trade updates." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = transitionTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transition payload." }, { status: 400 });
  }
  const { ref } = await context.params;
  try {
    const trade = await transitionTrade(session.user.id, ref, parsed.data, clientIp(request));
    return NextResponse.json(trade);
  } catch (error) {
    return jsonTradeError(error, "Could not update trade.");
  }
}
