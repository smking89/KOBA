"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TradeOfferView } from "@/features/trade/lib/types";

function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function TradeActions({ trade }: { trade: TradeOfferView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const open = trade.state === "PENDING" || trade.state === "COUNTERED";
  const canAccept = open && trade.viewerRole === "counterparty";
  const canReject = open && trade.viewerRole === "counterparty";
  const canCancel = open && trade.viewerRole === "proposer";
  const canReport = trade.viewerRole !== null;

  async function post(path: string, body: Record<string, unknown>) {
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Request failed.");
    }
  }

  function run(action: () => Promise<void>) {
    startTransition(() => {
      void action()
        .then(() => router.refresh())
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Action failed.");
        });
    });
  }

  const reportDisabled = useMemo(
    () => reportReason.trim().length < 8 || pending,
    [reportReason, pending],
  );

  if (!open && !canReport) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canAccept ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                post(`/api/trade/${trade.publicRef}/accept`, {
                  idempotencyKey: newIdempotencyKey("accept"),
                }),
              )
            }
          >
            Accept
          </Button>
        ) : null}
        {canReject ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() =>
                post(`/api/trade/${trade.publicRef}/reject`, {
                  idempotencyKey: newIdempotencyKey("reject"),
                }),
              )
            }
          >
            Reject
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() =>
                post(`/api/trade/${trade.publicRef}/cancel`, {
                  idempotencyKey: newIdempotencyKey("cancel"),
                }),
              )
            }
          >
            Cancel
          </Button>
        ) : null}
        {canReport ? (
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => setReportOpen((value) => !value)}
          >
            Report
          </Button>
        ) : null}
      </div>

      {reportOpen ? (
        <div className="space-y-2 rounded-md border border-border bg-surface-2 p-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Why are you reporting this trade?</span>
            <textarea
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              maxLength={500}
            />
          </label>
          <Button
            size="sm"
            variant="danger"
            disabled={reportDisabled}
            onClick={() =>
              run(async () => {
                await post(`/api/trade/${trade.publicRef}/report`, {
                  reason: reportReason.trim(),
                });
                setReportOpen(false);
                setReportReason("");
              })
            }
          >
            Submit report
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
