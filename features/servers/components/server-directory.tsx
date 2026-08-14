"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { MOCK_SERVERS } from "@/features/servers/lib/catalog";
import {
  hasCapability,
  visibleMap,
  visiblePlayerCount,
  visibleQueue,
} from "@/features/servers/lib/types";

export function ServerDirectory() {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("ALL");

  const servers = useMemo(() => {
    return MOCK_SERVERS.filter((server) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        server.name.toLowerCase().includes(q) ||
        server.region.toLowerCase().includes(q) ||
        server.tags.some((tag) => tag.includes(q));
      const matchesGame = game === "ALL" || server.game === game;
      return matchesQuery && matchesGame;
    });
  }, [query, game]);

  const games = [...new Set(MOCK_SERVERS.map((server) => server.game))];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Game servers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Directory of community servers. Metrics only appear when the linked connection reports
            that capability — KOBA never invents player counts or map data.
          </p>
        </div>
        <Link
          href="/servers/connect"
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand-gradient px-4 text-sm font-semibold text-background"
        >
          Connect server
        </Link>
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
        {servers.map((server) => {
          const players = visiblePlayerCount(server);
          const queue = visibleQueue(server);
          const map = visibleMap(server);
          return (
            <li key={server.slug}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{server.name}</CardTitle>
                  <StatusPill
                    tone={
                      server.status === "ONLINE"
                        ? "success"
                        : server.status === "OFFLINE"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {hasCapability(server, "STATUS") ? (server.status ?? "UNKNOWN") : "No status"}
                  </StatusPill>
                </div>
                <CardDescription>
                  {server.game} · {server.platformFamily} · {server.region}
                </CardDescription>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <dt>Players</dt>
                    <dd className="text-foreground">
                      {players == null
                        ? "—"
                        : `${players}${server.maxPlayers != null ? ` / ${server.maxPlayers}` : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Queue</dt>
                    <dd className="text-foreground">{queue == null ? "—" : queue}</dd>
                  </div>
                  <div>
                    <dt>Map</dt>
                    <dd className="text-foreground">
                      {map == null ? "—" : `${map.name ?? "—"}${map.size ? ` (${map.size})` : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Ping</dt>
                    <dd className="text-foreground">
                      {server.pingMs != null ? `${server.pingMs} ms` : "—"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">@{server.ownerHandle}</p>
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
