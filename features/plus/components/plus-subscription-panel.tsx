"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/koba/status-pill";
import { plusStateLabel, type PlusSubscriptionView } from "@/features/plus/lib/types";

export function PlusSubscriptionPanel({ initial }: { initial: PlusSubscriptionView }) {
  const [subscription, setSubscription] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkout", idempotencyKey: crypto.randomUUID() }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not start Plus checkout.");
      return;
    }
    if (payload.url) {
      window.location.assign(payload.url);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      subscription?: PlusSubscriptionView;
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not cancel Plus.");
      return;
    }
    if (payload.subscription) {
      setSubscription(payload.subscription);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-sm">
        <StatusPill tone="neutral">{plusStateLabel(subscription.state)}</StatusPill>
        {subscription.tenureBadgeLabel ? (
          <span className="ml-2 text-muted">{subscription.tenureBadgeLabel}</span>
        ) : null}
        {subscription.renewsAt ? (
          <span className="ml-2 text-xs text-muted">
            {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
            {new Date(subscription.renewsAt).toLocaleDateString()}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {subscription.state === "ACTIVE" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || subscription.cancelAtPeriodEnd}
            onClick={() => void cancel()}
          >
            {subscription.cancelAtPeriodEnd
              ? "Cancellation scheduled"
              : busy
                ? "Working…"
                : "Cancel"}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void subscribe()}>
            {busy ? "Redirecting…" : "Subscribe — $4.99/month"}
          </Button>
        )}
      </div>
    </div>
  );
}
