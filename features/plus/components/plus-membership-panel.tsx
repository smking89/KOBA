"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { PlusBadge } from "@/features/plus/components/plus-badge";
import {
  PLUS_BENEFITS,
  plusStateLabel,
  type PlusSubscriptionView,
} from "@/features/plus/lib/types";

type PlanRow = {
  code: string;
  displayName: string;
  interval: "MONTHLY" | "ANNUAL";
  priceLabel: string;
  active: boolean;
  configured: boolean;
};

type PlusMembershipPanelProps = {
  initial: PlusSubscriptionView;
  plans: PlanRow[];
  signedIn: boolean;
  checkoutHint?: string | null;
};

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `plus-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export function PlusMembershipPanel({
  initial,
  plans,
  signedIn,
  checkoutHint,
}: PlusMembershipPanelProps) {
  const router = useRouter();
  const [subscription, setSubscription] = useState(initial);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    setSubscription(initial);
  }, [initial]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (checkoutHint !== "processing") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/plus", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as PlusSubscriptionView;
        setSubscription(next);
        if (next.entitled || next.state === "PAST_DUE") {
          router.replace("/plus");
          router.refresh();
        }
      } catch {
        /* Processing UI stays until a verified webhook refresh succeeds. */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [checkoutHint, router]);

  const processing = checkoutHint === "processing" || subscription.processing;
  const statusLabel = processing ? "Processing" : plusStateLabel(subscription.displayState);

  const tone = useMemo(() => {
    if (processing) return "neutral" as const;
    if (subscription.displayState === "ACTIVE") return "success" as const;
    if (subscription.displayState === "PAST_DUE" || subscription.displayState === "UNPAID") {
      return "warning" as const;
    }
    return "neutral" as const;
  }, [processing, subscription.displayState]);

  async function post(path: string, body: Record<string, string>) {
    setBusy(path);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        url?: string;
        subscription?: PlusSubscriptionView;
      };
      if (!response.ok) {
        setError(payload.error ?? "Request failed.");
        return;
      }
      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }
      if (payload.subscription) {
        setSubscription(payload.subscription);
        router.refresh();
      }
    } catch {
      setError("Network error. Subscription management requires internet.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {!online ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Subscription management requires internet. Billing status cannot be refreshed offline.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Current membership</CardTitle>
            <CardDescription>
              Plus belongs to this active KOBA account, not every role on the same login.
              {subscription.accountType ? ` Active mode: ${subscription.accountType}.` : ""}
            </CardDescription>
          </div>
          <PlusBadge visible={subscription.badgeVisible} />
        </CardHeader>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill tone={tone}>{statusLabel}</StatusPill>
          {subscription.planCode ? (
            <span className="text-sm text-muted">{subscription.planCode}</span>
          ) : null}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {formatDate(subscription.renewsAt) ? (
            <li>Renews {formatDate(subscription.renewsAt)}</li>
          ) : null}
          {formatDate(subscription.accessEndsAt) ? (
            <li>Access ends {formatDate(subscription.accessEndsAt)}</li>
          ) : null}
          {subscription.publicRef ? (
            <li className="font-mono text-xs">Ref {subscription.publicRef}</li>
          ) : null}
        </ul>
        {processing ? (
          <p className="mt-3 text-sm text-muted">
            Checkout completed. Waiting for verified Stripe webhook before activating Plus.
          </p>
        ) : null}
        {checkoutHint === "cancelled" ? (
          <p className="mt-3 text-sm text-muted">Checkout was cancelled. No charge was applied.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {signedIn && (subscription.state === "PAST_DUE" || subscription.state === "UNPAID") ? (
            <Button
              size="sm"
              disabled={!online || busy !== null}
              onClick={() => void post("/api/plus/portal", {})}
            >
              Manage billing
            </Button>
          ) : null}
          {signedIn && subscription.entitled && !subscription.cancelAtPeriodEnd ? (
            confirmCancel ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!online || busy !== null}
                  onClick={() =>
                    void post("/api/plus/cancel", { idempotencyKey: newIdempotencyKey() })
                  }
                >
                  Confirm cancel at period end
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
                  Keep Plus
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
                Cancel at period end
              </Button>
            )
          ) : null}
          {signedIn && subscription.entitled && subscription.cancelAtPeriodEnd ? (
            <Button
              size="sm"
              disabled={!online || busy !== null}
              onClick={() =>
                void post("/api/plus/reactivate", { idempotencyKey: newIdempotencyKey() })
              }
            >
              Undo cancellation
            </Button>
          ) : null}
          {signedIn && subscription.hasBillingCustomer ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!online || busy !== null}
              onClick={() => void post("/api/plus/portal", {})}
            >
              Open customer portal
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="grid items-stretch gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.code} className="flex h-full flex-col gap-4">
            <div>
              <CardTitle>{plan.displayName}</CardTitle>
              <p className="mt-2 font-mono text-xl tracking-tight text-foreground">
                {plan.priceLabel}
              </p>
            </div>
            <Button
              className="mt-auto"
              disabled={
                !signedIn ||
                !online ||
                !plan.configured ||
                busy !== null ||
                subscription.entitled ||
                processing
              }
              onClick={() =>
                void post("/api/plus/checkout", {
                  planCode: plan.code,
                  idempotencyKey: newIdempotencyKey(),
                })
              }
            >
              {!signedIn
                ? "Sign in to subscribe"
                : !plan.configured
                  ? "Test price not configured"
                  : subscription.entitled
                    ? "Already a member"
                    : `Choose ${plan.interval === "ANNUAL" ? "annual" : "monthly"}`}
            </Button>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Free vs Plus</CardTitle>
        <CardDescription>
          Only approved benefits are enabled. Unapproved ideas stay marked as coming later.
        </CardDescription>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Benefit</th>
                <th className="w-24 py-2 pr-4 font-medium">Free</th>
                <th className="w-32 py-2 font-medium">Plus</th>
              </tr>
            </thead>
            <tbody>
              {PLUS_BENEFITS.map((benefit) => (
                <tr key={benefit.id} className="border-b border-border/70 last:border-0">
                  <td className="py-3 pr-4 align-top">
                    <div>{benefit.label}</div>
                    {benefit.note ? (
                      <div className="mt-0.5 text-xs text-muted">{benefit.note}</div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 align-top text-muted">{benefit.free ? "Yes" : "—"}</td>
                  <td className="py-3 align-top">
                    {benefit.comingLater ? "Coming later" : benefit.plus ? "Yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
