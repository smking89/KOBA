"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Person = { name: string; kobaId: string | null };

export function GroupModeratePanel({
  slug,
  canInvite,
  canModerate,
  requests,
  bans,
}: {
  slug: string;
  canInvite: boolean;
  canModerate: boolean;
  requests: Person[];
  bans: Person[];
}) {
  const router = useRouter();
  const [kobaId, setKobaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function moderate(action: string, targetKobaId: string, role?: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/groups/${slug}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, kobaId: targetKobaId, role }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not update the group.");
      return;
    }
    setKobaId("");
    router.refresh();
  }

  if (!canInvite && !canModerate) {
    return null;
  }

  return (
    <Card>
      <CardTitle>Moderation</CardTitle>
      <CardDescription>
        Group Admin and Moderator badges are community roles — not KOBA staff (SA/AD/MD).
      </CardDescription>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {canInvite ? (
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (kobaId.trim()) {
              void moderate("invite", kobaId.trim());
            }
          }}
        >
          <Input
            value={kobaId}
            onChange={(event) => setKobaId(event.target.value)}
            placeholder="KOBA-PL-9F42"
            aria-label="Invite by KOBAID"
            className="max-w-56"
          />
          <Button type="submit" size="sm" disabled={busy}>
            Invite
          </Button>
        </form>
      ) : null}

      {canModerate && requests.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {requests.map((row) => (
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
                  onClick={() => row.kobaId && void moderate("approve", row.kobaId)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !row.kobaId}
                  onClick={() => row.kobaId && void moderate("deny", row.kobaId)}
                >
                  Deny
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {canModerate && bans.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-muted uppercase">Banned</p>
          <ul className="mt-2 space-y-2 text-sm">
            {bans.map((row) => (
              <li key={row.kobaId ?? row.name} className="flex items-center justify-between gap-2">
                <span>
                  {row.name} <span className="font-mono text-xs text-muted">{row.kobaId}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || !row.kobaId}
                  onClick={() => row.kobaId && void moderate("unban", row.kobaId)}
                >
                  Unban
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
