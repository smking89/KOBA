import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { jsonWalletError } from "@/features/wallet/lib/http";
import { coinPurchaseSchema } from "@/features/wallet/lib/coin-purchase.schemas";
import { createCoinPurchaseCheckout } from "@/features/wallet/services/coin-purchase.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Sign in to buy Coins." }, { status: 401 });
  }

  const limited = await rateLimit(`coin-purchase:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many purchase attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = coinPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid purchase payload." }, { status: 400 });
  }

  try {
    const result = await createCoinPurchaseCheckout(session.user.id, parsed.data);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonWalletError(error, "Could not start Coin purchase.");
  }
}
