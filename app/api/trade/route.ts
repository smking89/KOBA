import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { createTradeSchema } from "@/features/trade/schemas/trade.schemas";
import { createTradeOffer, listTradesForUser } from "@/features/trade/services/trade.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`trade-list:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many trade list requests." },
      { status: 429, headers: noStore },
    );
  }
  try {
    return NextResponse.json(
      { items: await listTradesForUser(session.user.id) },
      { headers: noStore },
    );
  } catch (error) {
    return jsonTradeError(error, "Could not load trades.");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`trade-create:${session.user.id}`, 20, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many trade create attempts." },
      { status: 429, headers: noStore },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }
  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trade details." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const trade = await createTradeOffer(session.user.id, parsed.data, clientIp(request));
    return NextResponse.json(trade, { status: 201, headers: noStore });
  } catch (error) {
    return jsonTradeError(error, "Could not create trade.");
  }
}
