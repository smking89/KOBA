"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type RequestRow = { name: string; kobaId: string | null; status: string };

export function LfgAuthorPanel({
  publicRef,
  requests,
}: {
  publicRef: string;
  requests: RequestRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "accept" | "deny" | "cancel", kobaId?: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/lfg/${publicRef}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, kobaId }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not update the party.");
      return;
    }
    router.refresh();
  }

  const pending = requests.filter((row) => row.status === "PENDING");

  return (
    <Card>
      <CardTitle>Party requests</CardTitle>
      <CardDescription>
        Accept players until the roster is full. Expired posts cannot take seats.
      </CardDescription>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No pending requests.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {pending.map((row) => (
            <li
              key={row.kobaId ?? row.name}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                {row.name} <span className="font-mono text-xs text-muted">{row.kobaId}</span>
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !row.kobaId}
                  onClick={() => row.kobaId && void run("accept", row.kobaId)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !row.kobaId}
                  onClick={() => row.kobaId && void run("deny", row.kobaId)}
                >
                  Deny
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Button size="sm" variant="danger" disabled={busy} onClick={() => void run("cancel")}>
          Close post
        </Button>
      </div>
    </Card>
  );
}
