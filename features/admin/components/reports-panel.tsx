"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

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
    return <p className="text-sm text-muted">No open content reports.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {reports.map((report) => (
          <li key={report.publicRef} className="space-y-3 px-4 py-3">
            <div className="space-y-1">
              <p className="font-mono text-xs text-neon-lime">{report.publicRef}</p>
              <p className="text-sm text-foreground">
                {report.targetType} · <span className="font-mono text-xs">{report.targetRef}</span>
              </p>
              <p className="text-sm text-muted">{report.reason}</p>
              <p className="text-xs text-muted">
                {report.reporterHandle ? `@${report.reporterHandle}` : "reporter"} ·{" "}
                {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
