"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_TONE: Record<string, "live" | "warning" | "default"> = {
  DELIVERED: "live",
  FAILED: "warning",
  PENDING: "default",
};

const STATUS_LABEL: Record<string, string> = {
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  PENDING: "Delivering…",
};

export function RconDeliveryStatus({
  publicRef,
  status,
  error,
  canRetry,
}: {
  publicRef: string;
  status: string;
  error: string | null;
  canRetry: boolean;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function retry() {
    setRetrying(true);
    setLocalError(null);
    const response = await fetch(`/api/business/orders/${publicRef}/redeliver`, { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setRetrying(false);
    if (!response.ok) {
      setLocalError(payload.error ?? "Could not retry delivery.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Auto-delivery</p>
        <Badge tone={STATUS_TONE[status] ?? "default"}>{STATUS_LABEL[status] ?? status}</Badge>
      </div>
      {status === "FAILED" && error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {localError ? <p className="mt-2 text-sm text-destructive">{localError}</p> : null}
      {status === "FAILED" && canRetry ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" disabled={retrying} onClick={() => void retry()}>
            {retrying ? "Retrying…" : "Retry delivery"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
