import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonTradeError } from "@/features/trade/lib/http";
import { listMyTradeable } from "@/features/inventory/services/inventory.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }
  const limited = await rateLimit(`inventory-mine:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many inventory requests." },
      { status: 429, headers: noStore },
    );
  }
  try {
    const items = await listMyTradeable(session.user.id);
    return NextResponse.json({ items }, { headers: noStore });
  } catch (error) {
    return jsonTradeError(error, "Could not load your inventory.");
  }
}
