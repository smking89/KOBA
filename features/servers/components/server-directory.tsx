"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
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
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Game servers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Directory of verified community servers. Metrics only appear when a capability reports
            them — KOBA never invents player counts or map data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/servers/manage"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold"
          >
            Manage servers
          </Link>
          <Link
            href="/servers/connect"
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand-gradient px-4 text-sm font-semibold text-background"
          >
            RCON (14E)
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle>Filters</CardTitle>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, region, tags"
            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
            aria-label="Search servers"
          />
          <select
            value={game}
            onChange={(event) => setGame(event.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm sm:w-48"
            aria-label="Filter by game"
          >
            <option value="ALL">All games</option>
            {games.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <ul className="grid gap-4 md:grid-cols-2">
        {servers.length === 0 ? (
          <li className="text-sm text-muted">No verified servers in the directory yet.</li>
        ) : null}
        {servers.map((server) => {
          const players = visiblePlayerCount(server);
          const queue = visibleQueue(server);
          const map = visibleMap(server);
          return (
            <li key={server.slug}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{server.name}</CardTitle>
                  <div className="flex flex-col items-end gap-1">
                    <StatusPill
                      tone={
                        server.status === "ONLINE"
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
                    <StatusPill
                      tone={server.verificationStatus === "VERIFIED" ? "success" : "neutral"}
                    >
                      {server.verificationStatus}
                    </StatusPill>
                  </div>
                </div>
                <CardDescription>
                  {server.game} · {server.platformFamily} · {server.region}
                </CardDescription>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <dt>Players ({metricStateLabel(server.playersState)})</dt>
                    <dd className="text-foreground">
                      {players == null
                        ? "—"
                        : `${players}${server.maxPlayers != null ? ` / ${server.maxPlayers}` : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Queue ({metricStateLabel(server.queueState)})</dt>
                    <dd className="text-foreground">{queue == null ? "—" : queue}</dd>
                  </div>
                  <div>
                    <dt>Map ({metricStateLabel(server.mapState)})</dt>
                    <dd className="text-foreground">
                      {map == null ? "—" : `${map.name ?? "—"}${map.size ? ` (${map.size})` : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Freshness</dt>
                    <dd className="text-foreground">{freshnessLabel(server)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">
                  @{server.ownerHandle}
                  {server.favouriteCount != null ? ` · ${server.favouriteCount} favourites` : ""}
                </p>
                <Link
                  href={`/servers/${server.slug}`}
                  className="mt-3 inline-block text-sm text-neon-mint hover:underline"
                >
                  Details
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
