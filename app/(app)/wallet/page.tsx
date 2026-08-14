import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/koba/status-pill";
import { cn } from "@/lib/utils";
import { MOCK_COIN_TX, MOCK_WALLET, coinCategoryLabel } from "@/features/wallet/lib/types";

export const metadata = { title: "Wallet" };

export default function WalletPage() {
  const wallet = MOCK_WALLET;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">KOBA Coins</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Presentation wallet only. Balances are not mutated here — future settlement uses a
          double-entry ledger (accounts, debit/credit, reservation, capture, release, refund).
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
          {MOCK_COIN_TX.map((tx) => (
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
          ))}
        </ul>
      </Card>
    </div>
  );
}
