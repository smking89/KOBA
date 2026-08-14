import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { createTradeSchema } from "@/features/trade/schemas/trade.schemas";
import { createTradeOffer, listTradesForUser } from "@/features/trade/services/trade.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json({ items: await listTradesForUser(session.user.id) });
  } catch (error) {
    return jsonTradeError(error, "Could not load trades.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limited = await rateLimit(`trade-create:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many trade create attempts." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trade details." }, { status: 400 });
  }
  try {
    const trade = await createTradeOffer(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(trade, { status: 201 });
  } catch (error) {
    return jsonTradeError(error, "Could not create trade.");
  }
}
