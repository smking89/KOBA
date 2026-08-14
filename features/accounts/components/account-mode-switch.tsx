"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_TYPE_LABEL,
  PUBLIC_ACCOUNT_TYPES,
  dashboardPathFor,
  type PublicAccountType,
} from "@/features/koba-id/lib/format";
import type { AccountSnapshot } from "@/features/accounts/services/account.service";
import type { KobaAccountType } from "@/features/koba-id/lib/format";

const MODE_COPY: Record<PublicAccountType, { active: string[]; hidden: string[] }> = {
  PLAYER: {
    active: ["Marketplace buying & bidding", "Groups, LFG, DMs, social feed", "Cosmetic inventory"],
    hidden: ["Shop tools & product uploads", "Developer portal", "Promo page & referral codes"],
  },
  BUSINESS: {
    active: ["Shop tools & product uploads", "Orders and payouts", "Developer portal (later)"],
    hidden: ["Influencer referral codes"],
  },
  INFLUENCER: {
    active: ["Promo page & referral codes", "Partner earnings", "Audience tools"],
    hidden: ["Shop product management"],
  },
};

type AccountModeSwitchProps = {
  snapshot: AccountSnapshot;
};

export function AccountModeSwitch({ snapshot }: AccountModeSwitchProps) {
  const router = useRouter();
  const { update } = useSession();
  const [current, setCurrent] = useState(snapshot);
  const [busy, setBusy] = useState<PublicAccountType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owned = new Set(current.identities.map((identity) => identity.accountType));

  async function applySnapshot(next: AccountSnapshot) {
    setCurrent(next);
    await update({
      kobaId: next.kobaId,
      accountType: next.activeAccountType,
      kobaIdRevealed: next.kobaIdRevealed,
    });
    router.refresh();
  }

  async function switchTo(accountType: PublicAccountType) {
    setBusy(accountType);
    setError(null);

    const response = await fetch("/api/accounts/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountType }),
    });
    const payload = (await response.json()) as { error?: string; snapshot?: AccountSnapshot };

    setBusy(null);

    if (!response.ok || !payload.snapshot) {
      setError(payload.error ?? "Could not switch account.");
      return;
    }

    await applySnapshot(payload.snapshot);
    router.push(dashboardPathFor(accountType));
  }

  async function mint(accountType: PublicAccountType) {
    setBusy(accountType);
    setError(null);

    const response = await fetch("/api/accounts/identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountType }),
    });
    const payload = (await response.json()) as { error?: string; snapshot?: AccountSnapshot };

    setBusy(null);

    if (!response.ok || !payload.snapshot) {
      setError(payload.error ?? "Could not mint KOBAID.");
      return;
    }

    await applySnapshot(payload.snapshot);
    router.push("/kobaid");
  }

  const activeCopy = MODE_COPY[current.activeAccountType as PublicAccountType] ?? MODE_COPY.PLAYER;

  return (
    <div className="space-y-4">
      <div className="flex overflow-hidden rounded-full border border-border">
        {PUBLIC_ACCOUNT_TYPES.map((type) => {
          const active = current.activeAccountType === type;
          return (
            <button
              key={type}
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (owned.has(type)) {
                  void switchTo(type);
                } else {
                  void mint(type);
                }
              }}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-brand-gradient text-background"
                  : "bg-transparent text-muted hover:text-foreground",
              )}
            >
              {ACCOUNT_TYPE_LABEL[type]}
            </button>
          );
        })}
      </div>
      <p className="font-mono text-sm text-muted">
        Active: {current.kobaId ?? "—"} · {ACCOUNT_TYPE_LABEL[current.activeAccountType]} mode
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardTitle>Active in {ACCOUNT_TYPE_LABEL[current.activeAccountType]} mode</CardTitle>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {activeCopy.active.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <CardDescription className="mt-4">Hidden in this mode</CardDescription>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted/70">
          {activeCopy.hidden.map((item) => (
            <li key={item} className="line-through">
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Your KOBAIDs</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {current.identities.map((identity) => (
            <li key={identity.code} className="flex items-center justify-between gap-3">
              <span className="font-mono">{identity.code}</span>
              <span className="text-muted">
                {ACCOUNT_TYPE_LABEL[identity.accountType as KobaAccountType]}
              </span>
            </li>
          ))}
        </ul>
        {PUBLIC_ACCOUNT_TYPES.filter((type) => !owned.has(type)).length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {PUBLIC_ACCOUNT_TYPES.filter((type) => !owned.has(type)).map((type) => (
              <Button
                key={type}
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={() => void mint(type)}
              >
                Add {ACCOUNT_TYPE_LABEL[type]}
              </Button>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
