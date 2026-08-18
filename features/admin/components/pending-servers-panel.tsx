"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GameServerOwnerView } from "@/features/servers/lib/types";
import {
  ListPanel,
  ListPanelEmpty,
  ListRow,
  ListRowActions,
  ListRowMain,
  ListRowMeta,
  ListRowTitle,
} from "@/components/dashboard/list-panel";

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
    return <ListPanelEmpty>No servers pending verification.</ListPanelEmpty>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ListPanel>
        {items.map((server) => (
          <ListRow key={server.publicRef}>
            <ListRowMain>
              <ListRowTitle>{server.name}</ListRowTitle>
              <ListRowMeta>
                {server.game} · {server.platformFamily} · @{server.ownerHandle} ·{" "}
                {server.ownerAccountType}
              </ListRowMeta>
              <p className="font-mono text-xs break-all text-muted">
                Token: {server.verificationToken ?? "—"}
              </p>
            </ListRowMain>
            <ListRowActions>
              <Button
                size="sm"
                disabled={busy === server.slug}
                onClick={() => moderate(server.slug, { action: "approve" })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === server.slug}
                onClick={() => {
                  const reason = window.prompt("Rejection reason (required)");
                  if (!reason || reason.trim().length < 3) return;
                  void moderate(server.slug, { action: "reject", reason: reason.trim() });
                }}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy === server.slug}
                onClick={() => {
                  const reason = window.prompt("Suspension reason (required)");
                  if (!reason || reason.trim().length < 3) return;
                  void moderate(server.slug, { action: "suspend", reason: reason.trim() });
                }}
              >
                Suspend
              </Button>
            </ListRowActions>
          </ListRow>
        ))}
      </ListPanel>
    </div>
  );
}
