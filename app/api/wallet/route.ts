import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonWalletError } from "@/features/wallet/lib/http";
import {
  getWalletSnapshot,
  listTransactions,
} from "@/features/wallet/services/ledger.service";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [wallet, transactions] = await Promise.all([
      getWalletSnapshot(session.user.id),
      listTransactions(session.user.id),
    ]);
    return NextResponse.json({ wallet, transactions });
  } catch (error) {
    return jsonWalletError(error, "Could not load wallet.");
  }
}
