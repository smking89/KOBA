"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import type { GameServerOwnerView } from "@/features/servers/lib/types";
import { metricStateLabel } from "@/features/servers/lib/types";

export function ServerManagePanel({ server }: { server: GameServerOwnerView }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(path: string, method: string, body?: unknown) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const init: RequestInit = { method };
      if (body !== undefined) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(body);
      }
      const res = await fetch(path, init);
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      setMessage("Updated.");
      router.refresh();
    } catch {
      setError("Network required for management actions.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardTitle>Owner dashboard</CardTitle>
      <CardDescription>
        Verification {server.verificationStatus} · Publication {server.publicationStatus} · Adapter{" "}
        {server.adapterKey}
      </CardDescription>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Verification token</dt>
          <dd className="font-mono text-xs break-all">{server.verificationToken ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Poll failures</dt>
          <dd>{server.pollFailures}</dd>
        </div>
        <div>
          <dt className="text-muted">Freshness</dt>
          <dd>
            {server.freshness.isStale ? "Stale" : "Fresh"} · source {server.freshness.source}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Players metric</dt>
          <dd>
            <StatusPill>{metricStateLabel(server.playersState)}</StatusPill>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        Place the verification token in your public server description / MOTD, then submit for staff
        review. Do not paste RCON passwords here.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || server.verificationStatus === "PENDING"}
          onClick={() => run(`/api/servers/${server.slug}/submit`, "POST")}
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Submit for verification
        </button>
        <button
          type="button"
          disabled={pending || server.verificationStatus !== "VERIFIED"}
          onClick={() =>
            run(`/api/servers/${server.slug}`, "PATCH", { publicationStatus: "PUBLISHED" })
          }
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(`/api/servers/${server.slug}`, "PATCH", { publicationStatus: "DRAFT" })
          }
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Unpublish
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(`/api/servers/${server.slug}`, "DELETE")}
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Archive
        </button>
        <Link
          href={`/servers/connect?server=${server.slug}`}
          className="h-9 inline-flex items-center text-sm text-neon-mint"
        >
          Rust RCON (read-only)
        </Link>
      </div>
      {message ? <p className="mt-2 text-sm text-neon-mint">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}
