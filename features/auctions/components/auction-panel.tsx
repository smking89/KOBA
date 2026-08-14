"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuctionCountdown } from "@/features/auctions/components/auction-countdown";
import type { PublicAuction } from "@/features/auctions/services/auction.service";
import { formatPrice } from "@/features/marketplace/lib/catalog";

export function AuctionPanel({
  slug,
  initial,
  signedIn,
  currency = "USD",
}: {
  slug: string;
  initial: PublicAuction;
  signedIn: boolean;
  currency?: string;
}) {
  const router = useRouter();
  const [auction, setAuction] = useState(initial);
  const [amount, setAmount] = useState(initial.nextMinCents);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAuction(initial);
    setAmount(initial.nextMinCents);
  }, [initial]);

  useEffect(() => {
    const source = new EventSource(`/api/auctions/${slug}/stream`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as PublicAuction;
        setAuction(payload);
        setAmount((current) => Math.max(current, payload.nextMinCents));
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => source.close();
  }, [slug]);

  const live = auction.status === "LIVE";
  const ended = auction.status === "ENDED" || auction.status === "RESERVED";
  const suggested = useMemo(
    () => formatPrice(auction.nextMinCents, currency),
    [auction.nextMinCents, currency],
  );

  async function submit() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/market/${slug}`);
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/auctions/${slug}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: amount,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const payload = (await response.json()) as PublicAuction & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not place bid.");
      return;
    }
    setAuction(payload);
    setAmount(payload.nextMinCents);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted uppercase">
            {ended ? "Final bid" : auction.highBidCents ? "Current bid" : "Starting bid"}
          </p>
          <p className="mt-1 font-mono text-3xl">
            {formatPrice(auction.highBidCents ?? auction.startingBidCents, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Min increment {formatPrice(auction.minIncrementCents, currency)} · next {suggested}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted uppercase">{ended ? "Ended" : "Ends in"}</p>
          <AuctionCountdown endsAt={auction.endsAt} className="font-mono text-lg text-neon-lime" />
        </div>
      </div>

      {auction.youAreWinning ? (
        <p className="text-sm text-neon-lime">You are the leading bid.</p>
      ) : null}
      {auction.status === "RESERVED" && auction.winnerDisplay ? (
        <p className="text-sm">Reserved for {auction.winnerDisplay}. Checkout ships in Phase 8.</p>
      ) : null}
      {auction.status === "ENDED" ? (
        <p className="text-sm text-muted">Auction ended with no bids.</p>
      ) : null}

      {live && !auction.isSeller ? (
        <div className="space-y-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Input
              type="number"
              min={auction.nextMinCents}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              aria-label="Bid amount in cents"
              className="max-w-40"
            />
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Bidding…" : `Place bid — ${formatPrice(amount, currency)}`}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Amount is in cents. Bids are final until someone outbids you.
          </p>
        </div>
      ) : null}

      {auction.isSeller && live ? (
        <p className="text-sm text-muted">
          Sellers and shop members cannot bid on their own listing.
        </p>
      ) : null}

      {auction.bids.length > 0 ? (
        <div>
          <p className="mb-2 text-xs text-muted uppercase">Bid history</p>
          <ul className="space-y-1 text-sm">
            {auction.bids.map((bid) => (
              <li key={`${bid.createdAt}-${bid.amountCents}`} className="flex justify-between">
                <span>
                  {bid.bidder}
                  {bid.isYou ? " (you)" : ""}
                </span>
                <span className="font-mono">{formatPrice(bid.amountCents, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
