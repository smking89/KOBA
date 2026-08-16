"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RustIntegrationPanel } from "@/features/servers/components/rust-integration-panel";
import { canConnectGameServer, type GameServerOwnerView } from "@/features/servers/lib/types";
import type { RustIntegrationHealth } from "@/features/servers/lib/types";

export function ServerConnectWizard({
  initialServers,
  selectedSlug,
}: {
  initialServers: GameServerOwnerView[];
  selectedSlug?: string;
}) {
  const { data: session, status } = useSession();
  const allowed = canConnectGameServer(session?.user.accountType);
  const rustServers = initialServers.filter(
    (server) => server.gameSlug === "rust" && server.platformFamily === "PC",
  );
  const [slug, setSlug] = useState(selectedSlug ?? rustServers[0]?.slug ?? "");
  const [health, setHealth] = useState<RustIntegrationHealth | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/servers/${slug}/integrations/rust`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as RustIntegrationHealth;
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === "loading") {
    return <p className="text-sm text-muted">Checking account…</p>;
  }

  if (!session?.user) {
    return (
      <Card>
        <CardTitle>Sign in required</CardTitle>
        <CardDescription>Business or Influencer KOBAIDs can connect servers.</CardDescription>
        <Link
          href="/login?callbackUrl=/servers/connect"
          className="mt-4 inline-block text-neon-mint"
        >
          Sign in
        </Link>
      </Card>
    );
  }

  if (!allowed) {
    return (
      <Card>
        <CardTitle>Business or Influencer only</CardTitle>
        <CardDescription>
          Active account type is {session.user.accountType ?? "unknown"}. Switch to a Business or
          Influencer KOBAID in Settings, or add that identity first.
        </CardDescription>
        <Link href="/settings" className="mt-4 inline-block text-neon-mint">
          Open settings
        </Link>
      </Card>
    );
  }

  const selected = rustServers.find((server) => server.slug === slug) ?? rustServers[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servers/manage" className="text-sm text-muted hover:text-foreground">
          ← Manage servers
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Connect Rust server</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Secure, read-only Rust PC integration. Saved passwords are never shown again. Kick, ban,
          and other administrative commands are disabled.
        </p>
      </div>

      {rustServers.length === 0 ? (
        <Card>
          <CardTitle>Register a Rust PC server first</CardTitle>
          <CardDescription>
            Integrations attach to an owned directory listing. Create a Rust PC server, then return
            here to configure RCON.
          </CardDescription>
          <Link href="/servers/manage" className="mt-4 inline-block text-neon-mint">
            Open server management
          </Link>
        </Card>
      ) : (
        <>
          <label className="block max-w-md space-y-1 text-sm">
            <span className="text-muted">Owned Rust PC server</span>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3"
              value={selected?.slug ?? ""}
              onChange={(event) => setSlug(event.target.value)}
            >
              {rustServers.map((server) => (
                <option key={server.slug} value={server.slug}>
                  {server.name}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <RustIntegrationPanel
              serverSlug={selected.slug}
              serverName={selected.name}
              initialHealth={health}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
