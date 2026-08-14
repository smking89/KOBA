import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonWalletError } from "@/features/wallet/lib/http";
import { getWalletSummary } from "@/features/wallet/services/ledger.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limited = await rateLimit(`wallet-summary:${session.user.id}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many wallet requests." }, { status: 429 });
  }

  try {
    const wallet = await getWalletSummary(session.user.id);
    return NextResponse.json(
      { wallet },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return jsonWalletError(error, "Could not load wallet.");
  }
}
