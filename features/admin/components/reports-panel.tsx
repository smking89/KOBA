"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowMain,
  ListRowMeta,
} from "@/components/dashboard/list-panel";

type OpenReport = {
  publicRef: string;
  targetType: string;
  targetRef: string;
  reason: string;
  createdAt: string;
  reporterHandle: string | null;
};

export function ReportsPanel({ reports }: { reports: OpenReport[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function resolve(publicRef: string, status: "REVIEWED" | "DISMISSED", hidePost = false) {
    setError(null);
    const response = await fetch(`/api/admin/reports/${encodeURIComponent(publicRef)}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, hidePost }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not resolve report.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (reports.length === 0) {
    return <ListPanelEmpty>No open content reports.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {reports.map((report) => (
          <ListRow key={report.publicRef}>
            <ListRowMain>
              <p className="font-mono text-xs text-neon-lime">{report.publicRef}</p>
              <p className="text-sm text-foreground">
                {report.targetType} · <span className="font-mono text-xs">{report.targetRef}</span>
              </p>
              <ListRowMeta className="text-sm">{report.reason}</ListRowMeta>
              <ListRowMeta>
                {report.reporterHandle ? `@${report.reporterHandle}` : "reporter"} ·{" "}
                {new Date(report.createdAt).toLocaleString()}
              </ListRowMeta>
            </ListRowMain>
            <ListRowActions>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void resolve(report.publicRef, "REVIEWED")}
              >
                Mark reviewed
              </Button>
              {report.targetType === "POST" ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => void resolve(report.publicRef, "REVIEWED", true)}
                >
                  Hide post
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void resolve(report.publicRef, "DISMISSED")}
              >
                Dismiss
              </Button>
            </ListRowActions>
          </ListRow>
        ))}
      </ListPanel>
    </div>
  );
}
