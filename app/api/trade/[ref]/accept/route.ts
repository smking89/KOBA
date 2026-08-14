import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/http/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { tradeMutationSchema } from "@/features/trade/schemas/trade.schemas";
import { acceptTrade } from "@/features/trade/services/trade.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`trade-accept:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many accept attempts." },
      { status: 429, headers: noStore },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }
  const parsed = tradeMutationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid accept payload." },
      { status: 400, headers: noStore },
    );
  }
  const { ref } = await context.params;
  try {
    const trade = await acceptTrade(
      session.user.id,
      ref,
      parsed.data.idempotencyKey,
      clientIp(request),
    );
    return NextResponse.json(trade, { headers: noStore });
  } catch (error) {
    return jsonTradeError(error, "Could not accept trade.");
  }
}
