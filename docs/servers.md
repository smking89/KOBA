# Game server directory and monitoring

Phase 14D — searchable directory, ownership, capabilities, verification, and safe status polling.

## Data model

`GameServer` is the directory entity:

- Identity: `publicRef`, `slug`, name, description
- Catalogue: `game` (directory slug), `platformFamily`
- Ownership: `ownerUserId` + `ownerAccountType` (active KOBA account)
- Publication vs verification vs operational status are **separate**
- Network: `hostname`, `queryPort`, `gamePort`, `hideResolvedIp`
- Adapter: `adapterKey`, declared `capabilities[]`
- Freshness: `lastRefreshAt`, `lastSuccessfulAt`, `freshUntil`, `pollFailures`, `nextPollAt`

`ServerStatusSnapshot` stores bounded operational history (7-day retention).

`ServerFavourite` is a composite PK `(userId, serverId)` — idempotent toggle.

`ServerCredential` exists for Phase 14E RCON sealing. This phase does **not** collect or exercise RCON admin commands.

## Ownership rules

- Players: browse, search, favourite
- Business / Influencer: register and manage only while that account type is **active**
- Staff: verify, reject, suspend, restore (reason required for reject/suspend/restore)

Account switching to another mode must not grant access to servers owned by a different KOBA account type on the same login user.

## Verification workflow

1. Create draft (no RCON password)
2. Place `verificationToken` in public MOTD / description
3. Submit → `PENDING`
4. Staff approve → `VERIFIED` (or reject with reason)
5. Owner may publish → `PUBLISHED` (directory visible only when published **and** verified)

## Capability matrix

Authoritative matrix: `features/servers/lib/capabilities.ts`.

Capabilities: `STATUS`, `PLAYER_COUNT`, `PLAYER_LIST`, `QUEUE_COUNT`, `MAP_INFO`, `MAP_SIZE`, `PING`, `PUBLIC_QUERY`, `RCON_READ`, `RCON_WRITE`, `JOIN_LINK`, `PC`, `CONSOLE`.

UI metric states: `AVAILABLE`, `NOT_SUPPORTED`, `TEMPORARILY_UNAVAILABLE`, `STALE`, `UNKNOWN`.

Never fabricate unsupported or expired metrics as live.

## Adapter architecture

```text
ServerQueryAdapter
- supports(game, platform)
- capabilities()
- allowedPorts()
- validateTarget()
- queryStatus()
```

Registry: `minecraft-java` (public query foundation) + `manual` (NOOP).

Adapters run only in the worker. Page render never opens sockets.

## Status freshness

Each public status payload includes `checkedAt`, `lastSuccessfulAt`, `freshUntil`, `isStale`, `source`.

Default TTL: 90s. Stale player counts must not be presented as current.

## Polling schedule

`pnpm servers:poll` → `scripts/poll-servers.mjs`

- Eligible: published + verified + non-manual adapter + due `nextPollAt`
- Jittered exponential backoff; circuit after repeated failures
- Bounded concurrency (default 4)
- One failure → UNKNOWN/DEGRADED, not permanent OFFLINE
- Snapshot retention: 7 days

Suitable for VPS cron. Do not introduce Kafka/Kubernetes for this phase.

## SSRF / network rules

`features/servers/lib/ssrf.ts`:

- Reject loopback, private IPv4/IPv6, link-local, multicast, metadata IPs
- Safe DNS resolve + revalidate before connect (rebinding defence)
- Approved ports per adapter; block admin DB/SSH ports
- Timeouts and response size limits
- No arbitrary HTTP URL fetching, no shell with user input, no browser-side checks

## Admin moderation

Staff queue on `/admin`. Audit actions: `SERVER_SUBMITTED`, `SERVER_VERIFIED`, `SERVER_REJECTED`, `SERVER_SUSPENDED`, `SERVER_RESTORED`, `SERVER_STATUS_POLL`.

Evidence and audit history are retained.

## PWA / caching

`/api/servers` and management routes are never service-worker cached. Live metrics must not appear current while offline.

## RCON boundary (Phase 14E)

Credential storage stubs may exist, but live RCON auth, admin commands, and credential UX belong to Phase 14E.
