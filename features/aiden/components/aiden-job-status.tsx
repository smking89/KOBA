"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import {
  AIDEN_DISCLAIMER,
  aidenAssetTypeLabel,
  aidenJobLabel,
  aidenTechnicalLabel,
  isTerminalAidenState,
  type AidenJobView,
} from "@/features/aiden/lib/types";

export function AidenJobStatus({ initial }: { initial: AidenJobView }) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJob(initial);
  }, [initial]);

  useEffect(() => {
    if (isTerminalAidenState(job.state)) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/aiden/jobs/${job.publicRef}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const next = (await response.json()) as AidenJobView;
          setJob(next);
          if (isTerminalAidenState(next.state)) router.refresh();
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job.publicRef, job.state, router]);

  async function cancel() {
    setError(null);
    const response = await fetch(`/api/aiden/jobs/${job.publicRef}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ action: "cancel", idempotencyKey: `cancel-${job.publicRef}` }),
    });
    const payload = (await response.json()) as AidenJobView & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not cancel.");
      return;
    }
    setJob(payload);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/aiden/create" className="text-sm text-muted hover:text-foreground">
          ← Create
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Generation job</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{AIDEN_DISCLAIMER}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-mono text-sm">{job.publicRef}</CardTitle>
            <CardDescription>
              {job.game} · {aidenAssetTypeLabel(job.assetType)} · {job.provider}/{job.model}
            </CardDescription>
          </div>
          <StatusPill
            tone={
              job.state === "SUCCEEDED" || job.state === "COMPLETED"
                ? "success"
                : job.state === "FAILED" || job.state === "CANCELLED"
                  ? "danger"
                  : "warning"
            }
          >
            {aidenJobLabel(job.state)}
          </StatusPill>
        </div>
        <p className="mt-4 text-sm">{job.prompt}</p>
        {job.assetPublicRef ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/aiden/library/${job.assetPublicRef}/media`}
            alt="Private concept preview"
            className="mt-4 h-56 w-full rounded-md border border-border object-contain bg-surface-2"
          />
        ) : null}
        <ul className="mt-4 space-y-1 text-sm text-muted">
          <li>Estimated: {job.estimatedCostCoins} KOBA Coins</li>
          <li>Actual: {job.actualCostCoins ?? "pending"}</li>
          <li>Readiness: {aidenTechnicalLabel(job.readiness)}</li>
          {job.failureReason ? <li>Failure: {job.failureReason}</li> : null}
        </ul>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {!isTerminalAidenState(job.state) ? (
            <Button size="sm" variant="ghost" onClick={() => void cancel()}>
              Cancel
            </Button>
          ) : null}
          {job.assetPublicRef ? (
            <Link href="/aiden/library">
              <Button size="sm">Open library</Button>
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
