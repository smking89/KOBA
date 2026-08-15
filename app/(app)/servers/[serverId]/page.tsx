import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/koba/status-pill";
import { getMockServer } from "@/features/servers/lib/catalog";
import {
  canConnectGameServer,
  hasCapability,
  visibleMap,
  visiblePlayerCount,
  visibleQueue,
} from "@/features/servers/lib/types";
import { getBySlugOrRef, getServerBio } from "@/features/servers/services/server.service";
import { ServerBioPanel } from "@/features/servers/components/server-bio-panel";

export const metadata = { title: "Server detail" };

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;
  let server = await getBySlugOrRef(serverId).catch(() => null);
  server ??= getMockServer(serverId) ?? null;
  if (!server) {
    notFound();
  }

  const session = await auth();
  const showOwnerTools = canConnectGameServer(session?.user.accountType);
  const myBio = session?.user.id
    ? await getServerBio(session.user.id, server.slug).catch(() => null)
    : null;

  const players = visiblePlayerCount(server);
  const queue = visibleQueue(server);
  const map = visibleMap(server);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servers" className="text-sm text-muted hover:text-foreground">
          ← Servers
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{server.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {server.game} · {server.platformFamily} · {server.region} · @{server.ownerHandle}
        </p>
      </div>

      <Card>
        <CardTitle>Live snapshot</CardTitle>
        <CardDescription>
          Last refresh: {server.lastRefreshAt ?? "Never — no telemetry capability yet"}
        </CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted">Status</dt>
            <dd>
              {hasCapability(server, "STATUS") ? (
                <StatusPill tone={server.status === "ONLINE" ? "success" : "neutral"}>
                  {server.status}
                </StatusPill>
              ) : (
                "Capability not reported"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Players</dt>
            <dd>{players == null ? "—" : `${players} / ${server.maxPlayers ?? "?"}`}</dd>
          </div>
          <div>
            <dt className="text-muted">Queue</dt>
            <dd>{queue == null ? "—" : queue}</dd>
          </div>
          <div>
            <dt className="text-muted">Map</dt>
            <dd>{map == null ? "—" : `${map.name ?? "—"}${map.size ? ` · ${map.size}` : ""}`}</dd>
          </div>
          <div>
            <dt className="text-muted">Join</dt>
            <dd className="font-mono text-xs">{server.joinInfo ?? "Not published"}</dd>
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
          {server.capabilities.map((capability) => (
            <StatusPill key={capability}>{capability}</StatusPill>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Your bio for this server</CardTitle>
        <CardDescription>
          A KOBA Plus perk — a bio just for this community, separate from your account bio.
        </CardDescription>
        <div className="mt-4">
          <ServerBioPanel
            serverSlug={server.slug}
            initialBio={myBio}
            signedIn={Boolean(session?.user.id)}
          />
        </div>
      </Card>

      {showOwnerTools ? (
        <Card>
          <CardTitle>Business / Influencer dashboard</CardTitle>
          <CardDescription>Manage connection and read-only monitoring.</CardDescription>
          <Link href="/servers/connect" className="mt-3 inline-block text-sm text-neon-mint">
            Open connection wizard
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
