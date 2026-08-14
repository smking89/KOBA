import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/koba/status-pill";
import { cn } from "@/lib/utils";
import { coinCategoryLabel, type CoinTransactionView, type WalletSnapshot } from "@/features/wallet/lib/types";
import {
  getWalletSnapshot,
  listTransactions,
} from "@/features/wallet/services/ledger.service";

export const metadata = { title: "Wallet" };

const EMPTY_WALLET: WalletSnapshot = {
  totalCoins: 0,
  purchased: 0,
  promotional: 0,
  earned: 0,
  reserved: 0,
};

export default async function WalletPage() {
  const session = await auth();
  let wallet: WalletSnapshot = EMPTY_WALLET;
  let transactions: CoinTransactionView[] = [];
  if (session?.user.id) {
    try {
      [wallet, transactions] = await Promise.all([
        getWalletSnapshot(session.user.id),
        listTransactions(session.user.id),
      ]);
    } catch {
      wallet = EMPTY_WALLET;
      transactions = [];
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">KOBA Coins</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Double-entry ledger balances. Purchase checkout is not implemented in this phase.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.totalCoins}</CardTitle>
          <CardDescription>Total</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.purchased}</CardTitle>
          <CardDescription>Purchased</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.promotional}</CardTitle>
          <CardDescription>Promotional</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.earned}</CardTitle>
          <CardDescription>Earned</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.reserved}</CardTitle>
          <CardDescription>Reserved</CardDescription>
        </Card>
      </div>

      <Card>
        <CardTitle>Buy Coins</CardTitle>
        <CardDescription>Checkout handoff stub — no charge.</CardDescription>
        <button type="button" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
          Buy Coins
        </button>
      </Card>

      <Card>
        <CardTitle>Transaction history</CardTitle>
        <ul className="mt-4 space-y-3">
          {transactions.length === 0 ? (
            <li className="text-sm text-muted">No ledger activity yet.</li>
          ) : (
            transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-col gap-1 border-b border-border/70 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{coinCategoryLabel(tx.category)}</p>
                  <p className="text-xs text-muted">{tx.note}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tx.bucket ? <StatusPill>{tx.bucket}</StatusPill> : null}
                  <span
                    className={cn(
                      "font-mono text-sm",
                      tx.amount < 0 ? "text-destructive" : "text-electric-green",
                    )}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
