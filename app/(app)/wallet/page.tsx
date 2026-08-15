import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/koba/status-pill";
import { cn } from "@/lib/utils";
import {
  coinCategoryLabel,
  type CoinTransactionView,
  type WalletSummary,
} from "@/features/wallet/lib/types";
import { getTransactionHistory, getWalletSummary } from "@/features/wallet/services/ledger.service";
import { listCoinPackages } from "@/features/wallet/lib/coin-packages";
import { BuyCoinsPanel } from "@/features/wallet/components/buy-coins-panel";

export const metadata = { title: "Wallet" };
export const dynamic = "force-dynamic";

const EMPTY: WalletSummary = {
  total: "0",
  available: "0",
  reserved: "0",
  purchased: "0",
  promotional: "0",
  earned: "0",
  currency: "KOBA_COIN",
  status: "ACTIVE",
};

export default async function WalletPage() {
  const session = await auth();
  let wallet: WalletSummary = EMPTY;
  let transactions: CoinTransactionView[] = [];
  let loadError: string | null = null;

  if (!session?.user.id) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">KOBA Coins</h1>
        <p className="text-sm text-muted">Sign in to view your wallet.</p>
        <Link href="/login" className={buttonVariants({ size: "sm" })}>
          Sign in
        </Link>
      </div>
    );
  }

  try {
    const [summary, page] = await Promise.all([
      getWalletSummary(session.user.id),
      getTransactionHistory(session.user.id, { limit: 40 }),
    ]);
    wallet = summary;
    transactions = page.items;
  } catch {
    loadError = "Could not load wallet ledger. Try again shortly.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">KOBA Coins</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Double-entry ledger balances. Available is spendable now; reserved is held for open
          reservations.
        </p>
      </div>

      {loadError ? (
        <Card>
          <CardTitle>Error</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.available}</CardTitle>
          <CardDescription>Available</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.reserved}</CardTitle>
          <CardDescription>Reserved</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-2xl tabular-nums">{wallet.total}</CardTitle>
          <CardDescription>Total (available + reserved)</CardDescription>
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
      </div>

      <Card>
        <CardTitle>Buy Coins</CardTitle>
        <CardDescription>
          Stripe Checkout (test mode). Coins credit once payment is confirmed by webhook — never
          instantly on redirect back.
        </CardDescription>
        <div className="mt-4">
          <BuyCoinsPanel packages={listCoinPackages()} />
        </div>
      </Card>

      <Card>
        <CardTitle>Transaction history</CardTitle>
        <CardDescription>Newest first. References are public ledger IDs.</CardDescription>
        <ul className="mt-4 space-y-3">
          {transactions.length === 0 ? (
            <li className="text-sm text-muted">No ledger activity yet.</li>
          ) : (
            transactions.map((tx) => (
              <li
                key={tx.publicRef}
                className="flex flex-col gap-1 border-b border-border/70 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{coinCategoryLabel(tx.category)}</p>
                  <p className="text-xs text-muted">{tx.description}</p>
                  <p className="mt-1 font-mono text-[0.65rem] text-muted">
                    <Link href={`/wallet?tx=${tx.publicRef}`} className="hover:text-neon-mint">
                      {tx.publicRef}
                    </Link>{" "}
                    · {new Date(tx.createdAt).toLocaleString()} · {tx.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {tx.bucket ? <StatusPill>{tx.bucket}</StatusPill> : null}
                  <span
                    className={cn(
                      "font-mono text-sm",
                      tx.direction === "debit" ? "text-destructive" : "text-electric-green",
                    )}
                  >
                    {tx.direction === "credit" ? `+${tx.amount}` : tx.amount}
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
