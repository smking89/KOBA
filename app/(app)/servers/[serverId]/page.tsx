import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { getAccountSnapshot } from "@/features/accounts/services/account.service";
import { ServerFavouriteButton } from "@/features/servers/components/server-favourite-button";
import { ServerManagePanel } from "@/features/servers/components/server-manage-panel";
import {
  hasCapability,
  metricStateLabel,
  visibleMap,
  visiblePlayerCount,
  visibleQueue,
} from "@/features/servers/lib/types";
import {
  getBySlugOrRef,
  getOwnerServer,
} from "@/features/servers/services/server.service";

export const metadata = { title: "Server detail" };

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;
  const session = await auth();
  const server = await getBySlugOrRef(serverId, session?.user.id ?? null).catch(() => null);
  if (!server) {
    notFound();
  }

  const snapshot = session?.user.id ? await getAccountSnapshot(session.user.id) : null;
  const ownerView =
    snapshot &&
    (await getOwnerServer(session!.user.id, serverId).catch(() => null));

  const players = visiblePlayerCount(server);
  const queue = visibleQueue(server);
  const map = visibleMap(server);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/servers" className="text-sm text-muted hover:text-foreground">
            ← Servers
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{server.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {server.game} · {server.platformFamily} · {server.region} · @{server.ownerHandle}
            {server.verificationStatus === "VERIFIED" ? " · Verified" : ""}
          </p>
        </div>
        {session?.user.id ? (
          <ServerFavouriteButton
            slug={server.slug}
            initialFavourited={Boolean(server.favouritedByMe)}
            initialCount={server.favouriteCount ?? 0}
          />
        ) : null}
      </div>

      {server.description ? (
        <p className="max-w-3xl text-sm text-muted">{server.description}</p>
      ) : null}

      <Card>
        <CardTitle>Live snapshot</CardTitle>
        <CardDescription>
          {server.freshness.isStale
            ? "Data is stale — not shown as current."
            : `Source ${server.freshness.source}`}
          {server.freshness.lastSuccessfulAt
            ? ` · Last success ${server.freshness.lastSuccessfulAt}`
            : " · No successful poll yet"}
        </CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {hasCapability(server, "STATUS") ? (
                <>
                  <StatusPill
                    tone={
                      server.status === "ONLINE"
                        ? "success"
                        : server.status === "OFFLINE"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {server.status ?? "UNKNOWN"}
                  </StatusPill>
                  <span className="text-xs text-muted">{metricStateLabel(server.statusState)}</span>
                </>
              ) : (
                metricStateLabel(server.statusState)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Players</dt>
            <dd>
              {players == null
                ? metricStateLabel(server.playersState)
                : `${players} / ${server.maxPlayers ?? "?"}`}
              {server.playersState === "STALE" ? " (stale)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Queue</dt>
            <dd>{queue == null ? metricStateLabel(server.queueState) : queue}</dd>
          </div>
          <div>
            <dt className="text-muted">Map</dt>
            <dd>
              {map == null
                ? metricStateLabel(server.mapState)
                : `${map.name ?? "—"}${map.size ? ` · ${map.size}` : ""}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Ping</dt>
            <dd>
              {server.pingState === "AVAILABLE" || server.pingState === "STALE"
                ? `${server.pingMs ?? "—"} ms`
                : metricStateLabel(server.pingState)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Join</dt>
            <dd className="font-mono text-xs">{server.joinInfo ?? "Not published"}</dd>
          </div>
          <div>
            <dt className="text-muted">Display host</dt>
            <dd className="font-mono text-xs">{server.displayHost ?? "Hidden"}</dd>
          </div>
          <div>
            <dt className="text-muted">Linked shop</dt>
            <dd>
              {server.linkedShopSlug ? (
                <Link href={`/shops/${server.linkedShopSlug}`} className="text-neon-mint">
                  {server.linkedShopSlug}
                </Link>
              ) : (
                "None"
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {server.tags.map((tag) => (
            <StatusPill key={tag}>{tag}</StatusPill>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {server.capabilities.map((capability) => (
            <StatusPill key={capability}>{capability}</StatusPill>
          ))}
        </div>
      </Card>

      {ownerView ? <ServerManagePanel server={ownerView} /> : null}

      <Card>
        <CardTitle>Report</CardTitle>
        <CardDescription>
          Use the existing content report flow for false ownership, fraud, or prohibited join info
          (target type SERVER).
        </CardDescription>
      </Card>
    </div>
  );
}
