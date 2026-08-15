# Rust PC read-only integration

Phase 14E — secure, read-only Rust server connection for owned Business and Influencer listings.

## Architecture

```text
Owner UI  →  thin /api/servers/[id]/integrations/rust* routes
          →  integration.service (auth, SSRF, encrypt, audit)
          →  rust adapter
                ├─ rust-a2s      public Steam A2S_INFO (no credentials)
                └─ rust-webrcon  Facepunch WebRCON, allowlisted serverinfo only
          →  VPS worker (pnpm servers:integrations)
```

Route handlers do not contain Rust protocol conditionals. They call the registered `rust` adapter through the integration service.

## Public query versus RCON

| Concern      | Public query (A2S)                                                    | WebRCON                                                |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Transport    | UDP Steam query                                                       | WebSocket `ws://ip:port/<password>`                    |
| Auth         | None                                                                  | RCON password in handshake path only                   |
| Typical port | 28015 (or `server.queryport`)                                         | 28016 (`rcon.port`)                                    |
| Fields       | name, map, players, max, tags, version, ping, `qp` queue when present | `serverinfo` JSON: hostname, players, max, queued, map |
| Credentials  | Never used                                                            | Decrypted only inside the worker                       |

Do not mix credentials into the public-query function.

## Supported capabilities

Enabled for Rust PC:

- `STATUS`
- `PLAYER_COUNT`
- `QUEUE_COUNT` (A2S `qpN` keywords and/or `serverinfo.Queued`)
- `MAP_INFO`
- `PING` (A2S RTT)
- `PUBLIC_QUERY`
- `RCON_READ`
- `PC`
- `JOIN_LINK`

Not enabled:

- `RCON_WRITE`
- `PLAYER_LIST` (`playerlist` includes SteamIDs and client addresses)
- `MAP_SIZE` (not present in A2S_INFO or `serverinfo`)

Zero players is stored as `0`. Unsupported or failed fields stay `null` and are not overwritten with fabricated zeros.

## Read-only allowlist

Internal action `SERVER_INFO` maps to Facepunch command `serverinfo`.

Rejected: kick, ban, unban, mute, give/spawn, teleport, change map, restart/shutdown, config changes, arbitrary console text, `playerlist`.

Browsers, API parameters, database fields, and admin forms cannot supply raw RCON commands.

## Credential encryption

- Algorithm: AES-256-GCM (`lib/crypto/credential-box.ts`)
- Key: `KOBA_CREDENTIAL_ENCRYPTION_KEY` (32 bytes, base64) from the environment — never PostgreSQL
- Version: `KOBA_CREDENTIAL_KEY_VERSION` plus optional `KOBA_CREDENTIAL_ENCRYPTION_KEY_V{n}`
- Unique 12-byte IV per seal
- 16-byte auth tag stored beside ciphertext
- AAD: `koba:rcon-credential:v1:{serverId}:{integrationId}`
- Missing key fails closed in every environment (no plaintext fallback)

After save, APIs return only `credentialsConfigured: true`. Forms never receive a saved password.

## Key rotation

1. Add `KOBA_CREDENTIAL_ENCRYPTION_KEY_V{old}` with the previous key.
2. Set `KOBA_CREDENTIAL_ENCRYPTION_KEY` and `KOBA_CREDENTIAL_KEY_VERSION` to the new key.
3. Existing rows decrypt with their stored `keyVersion`.
4. The next owner rotate re-seals under the current version.

## SSRF

Reuses `features/servers/lib/ssrf.ts`:

- Safe DNS + revalidate before connect
- Reject loopback, private, link-local, multicast, reserved, cloud metadata
- DNS rebinding defence
- Rust ports limited to 27015–27020 and 28000–28200
- Timeouts and response size limits
- No shell, no arbitrary URL fetch, no redirects

Private VPS-to-server networking is a separate future feature.

## Worker / VPS

```bash
pnpm servers:integrations
```

Cron on the owner VPS (not serverless request handlers, not the browser):

- Bounded concurrency (4)
- Per-integration `nextPollAt` + jitter
- Exponential backoff and circuit breaker after 5 failures
- Job table `ServerIntegrationJob` (Postgres). In-memory queues are not used and are not production-safe.
- Redis/Kafka/Kubernetes are not required
- Health: process exits if the encryption key is missing; `/api/health` reports `credentialEncryption`

## Rate limits and timeouts

- API: 15–60 requests / 15 minutes per user/action
- A2S: 2s connect / 4s total / 8 KiB
- WebRCON: 3s connect + 4s command / 16 KiB
- Public status TTL: 90s

## Failure states

Safe categories returned to the browser: invalid credentials, timeout, unreachable, unsupported server, protocol mismatch, rate limited, TLS/transport failure, internal configuration, SSRF rejected, circuit open.

Raw socket errors and stack traces are not sent to the client.

## Monitoring

`IntegrationAttempt` stores attempt type, success, category, duration, correlation id. Structured worker logs are redacted. Credentials, command text, and player PII are not recorded.

Owner notices: repeated failure, invalid credentials, stale integration, disconnect, credential rotation.

## Audit

`SERVER_INTEGRATION_CONNECTED`, `SERVER_INTEGRATION_TESTED`, `SERVER_CREDENTIAL_ROTATED`, `SERVER_INTEGRATION_DISCONNECTED`, `SERVER_CAPABILITY_CHANGED`, `SERVER_CIRCUIT_OPENED`.

Entries include actor, server, time, and safe reason — never credentials.

Staff may inspect health (`GET .../integrations/rust?staff=1`) but cannot decrypt credentials. Impersonation (`session.user.impersonatorId`) is rejected for credential operations.

## Adding another game adapter

1. Implement `ServerQueryAdapter` (and `ReadOnlyIntegrationAdapter` if authenticated).
2. Keep public query and authenticated transports in separate modules.
3. Register in `features/servers/adapters/registry.ts` and `runtime.ts`.
4. Declare only capabilities the adapter can retrieve reliably.
5. Add an explicit command allowlist before any authenticated protocol.
6. Reuse SSRF, credential-box, IntegrationAttempt, and the VPS worker pattern.

## Deferred administrative commands

Kick, ban, give, teleport, map/config changes, restart, and arbitrary console execution require a separate security review. This phase must not grow a generic “run command” endpoint.
