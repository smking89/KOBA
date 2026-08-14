import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonWalletError } from "@/features/wallet/lib/http";
import { getTransactionByRef } from "@/features/wallet/services/ledger.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`wallet-tx-detail:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many wallet requests." }, { status: 429 });
  }

  const { reference } = await context.params;
  try {
    const transaction = await getTransactionByRef(session.user.id, reference);
    return NextResponse.json({ transaction }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonWalletError(error, "Could not load transaction.");
  }
}
