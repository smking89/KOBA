"use client";

import { useState } from "react";
import type { GameServerOwnerView } from "@/features/servers/lib/types";

export function PendingServersPanel({ servers }: { servers: GameServerOwnerView[] }) {
  const [items, setItems] = useState(servers);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(slug: string, body: Record<string, string>) {
    setBusy(slug);
    setError(null);
    try {
      const res = await fetch(`/api/admin/servers/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Moderation failed.");
        return;
      }
      setItems((prev) => prev.filter((s) => s.slug !== slug));
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">No servers pending verification.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-3">
        {items.map((server) => (
          <li key={server.publicRef} className="rounded-md border border-border p-3 text-sm">
            <div className="font-medium">{server.name}</div>
            <div className="text-muted">
              {server.game} · {server.platformFamily} · @{server.ownerHandle} ·{" "}
              {server.ownerAccountType}
            </div>
            <div className="mt-1 font-mono text-xs break-all">
              Token: {server.verificationToken ?? "—"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === server.slug}
                className="h-8 rounded-md border border-border px-2 text-xs"
                onClick={() => moderate(server.slug, { action: "approve" })}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy === server.slug}
                className="h-8 rounded-md border border-border px-2 text-xs"
                onClick={() => {
                  const reason = window.prompt("Rejection reason (required)");
                  if (!reason || reason.trim().length < 3) return;
                  void moderate(server.slug, { action: "reject", reason: reason.trim() });
                }}
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy === server.slug}
                className="h-8 rounded-md border border-border px-2 text-xs"
                onClick={() => {
                  const reason = window.prompt("Suspension reason (required)");
                  if (!reason || reason.trim().length < 3) return;
                  void moderate(server.slug, { action: "suspend", reason: reason.trim() });
                }}
              >
                Suspend
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
