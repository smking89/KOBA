"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_TYPE_LABEL, dashboardPathFor } from "@/features/koba-id/lib/format";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

type KobaIdRevealProps = {
  code: string;
  accountType: KobaAccountType;
};

export function KobaIdReveal({ code, accountType }: KobaIdRevealProps) {
  const router = useRouter();
  const { update } = useSession();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function enter() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/accounts/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledged: true }),
    });

    if (!response.ok) {
      setBusy(false);
      setError("Could not continue. Try again.");
      return;
    }

    await update({ kobaIdRevealed: true, kobaId: code, accountType });
    router.push(dashboardPathFor(accountType));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <Badge tone="live">Minted · immutable</Badge>
      <div className="rounded-lg border border-border bg-surface p-8 shadow-soft">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Your KOBAID</p>
        <p className="mt-3 font-mono text-3xl font-bold tracking-wide text-foreground">{code}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Generated on the server and permanent.{" "}
          <span className="font-mono text-foreground">{code.split("-")[1]}</span> marks this as a{" "}
          {ACCOUNT_TYPE_LABEL[accountType]} ID. Add Business or Influencer later — each role gets
          its own code. Staff IDs are never self-registered.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button onClick={() => void enter()} disabled={busy}>
            {busy ? "Entering…" : "Enter KOBA"}
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
