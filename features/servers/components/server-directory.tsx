"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/koba/empty-state";
import { PageHeader } from "@/components/koba/page-header";
import { StatusPill } from "@/components/koba/status-pill";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  hasCapability,
  metricStateLabel,
  visibleMap,
  visiblePlayerCount,
  visibleQueue,
  type GameServerView,
} from "@/features/servers/lib/types";

function freshnessLabel(server: GameServerView): string {
  if (!server.freshness.lastSuccessfulAt) return "Never updated";
  if (server.freshness.isStale) return "Stale data";
  return "Fresh";
}

function hostInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "S";
}

export function ServerDirectory({ initialServers = [] }: { initialServers?: GameServerView[] }) {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("ALL");

  const servers = useMemo(() => {
    return initialServers.filter((server) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        server.name.toLowerCase().includes(q) ||
        server.region.toLowerCase().includes(q) ||
        server.tags.some((tag) => tag.includes(q));
      const matchesGame = game === "ALL" || server.game === game || server.gameSlug === game;
      return matchesQuery && matchesGame;
    });
  }, [query, game, initialServers]);

  const games = [...new Set(initialServers.map((server) => server.game))];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directory"
        title="Game servers"
        description="Verified community hosts. Metrics only appear when a capability reports them — KOBA never invents player counts or map data."
        actions={
          <>
            <Link href="/servers/manage" className={cn(buttonVariants({ variant: "secondary" }))}>
              Manage
            </Link>
            <Link href="/servers/connect" className={cn(buttonVariants())}>
              Connect host
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-lg bg-surface-3 p-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search hosts, region, tags"
          className="flex-1"
          aria-label="Search servers"
        />
        <NativeSelect
          value={game}
          onChange={(event) => setGame(event.target.value)}
          className="sm:w-48"
          aria-label="Filter by game"
        >
          <option value="ALL">All games</option>
          {games.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {servers.length === 0 ? (
        <EmptyState>No verified servers in the directory yet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {servers.map((server) => {
            const players = visiblePlayerCount(server);
            const queue = visibleQueue(server);
            const map = visibleMap(server);
            const online = server.status === "ONLINE";
            return (
              <li key={server.slug}>
                <article className="flex items-center gap-3 rounded-lg bg-surface-3 p-3 transition-colors hover:bg-white/6">
                  <div
                    className={cn(
                      "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold",
                      online ? "bg-brand-gradient text-background" : "bg-surface-2 text-neon-lime",
                    )}
                    aria-hidden
                  >
                    {hostInitials(server.name)}
                    <span
                      className={cn(
                        "absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-3",
                        online ? "bg-success" : "bg-muted",
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{server.name}</h2>
                      {server.verificationStatus === "VERIFIED" ? (
                        <Badge tone="success">Verified</Badge>
                      ) : (
                        <Badge>{server.verificationStatus}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {server.game} · {server.platformFamily} · {server.region}
                      {players != null
                        ? ` · ${players}${server.maxPlayers != null ? `/${server.maxPlayers}` : ""} playing`
                        : ""}
                      {queue != null ? ` · queue ${queue}` : ""}
                      {map?.name ? ` · ${map.name}` : ""}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                      @{server.ownerHandle}
                      {server.displayHost ? ` · ${server.displayHost}` : ""}
                      {server.favouriteCount != null
                        ? ` · ${server.favouriteCount} favourites`
                        : ""}
                      {" · "}
                      {freshnessLabel(server)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                    <StatusPill
                      tone={
                        online
                          ? "success"
                          : server.status === "OFFLINE" || server.status === "DEGRADED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {hasCapability(server, "STATUS")
                        ? (server.status ?? metricStateLabel(server.statusState))
                        : "No status"}
                    </StatusPill>
                    <Link
                      href={`/servers/${server.slug}`}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                    >
                      Open
                    </Link>
                  </div>
                  <Link
                    href={`/servers/${server.slug}`}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "sm:hidden",
                    )}
                  >
                    Open
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
