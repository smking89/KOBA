import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonWalletError } from "@/features/wallet/lib/http";
import { getTransactionHistory } from "@/features/wallet/services/ledger.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`wallet-tx:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many wallet requests." }, { status: 429 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 20;

  try {
    const page = await getTransactionHistory(session.user.id, {
      cursor,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return NextResponse.json(page, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonWalletError(error, "Could not load transactions.");
  }
}
