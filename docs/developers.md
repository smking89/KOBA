# KOBA developer portal and app marketplace

Phase 14H adds a publisher portal, hashed API keys, HTTPS webhooks, and a
staff-moderated marketplace for apps, plugins, bots, and downloadable digital
products. **KOBA never executes, imports, compiles, or runs third-party plugin
code** on the web server or VPS workers.

OAuth authorization-code flow is **deferred**. Redirect URIs are stored for a
future implementation. This phase does not mint fake access tokens.

## Publisher profiles

Eligible Player, Business, or Influencer KOBAIDs can create one publisher
profile (`/developers/new`). Staff KOBAIDs cannot publish.

Team roles:

| Role      | Products | API secrets | Members | Payouts / destroy |
| --------- | -------- | ----------- | ------- | ----------------- |
| OWNER     | yes      | yes         | yes     | yes               |
| ADMIN     | yes      | yes         | yes     | no                |
| DEVELOPER | yes      | no          | no      | no                |
| SUPPORT   | read     | no          | no      | no                |
| ANALYST   | read     | no          | no      | no                |

`verified` is staff-only (`DEV_PUBLISHER_VERIFIED`). Users cannot self-verify.

Contact email is stored privately and returned only to OWNER/ADMIN.

## Applications and API keys

Developers may create **sandbox** applications. Production environment and live
keys require staff approval (`productionApprovedAt`).

Key format:

- `koba_sandbox_<12 hex>_<secret>`
- `koba_live_<12 hex>_<secret>`

The full secret is returned **once** on create or rotate. The database stores
SHA-256 of the full key. List endpoints return `secret: null` and the public
prefix only.

Authenticate public API calls with:

```
Authorization: Bearer koba_sandbox_...
```

Never put keys in URLs, logs, or client analytics.

### Scopes

Read-only registry (no write or staff scopes):

- `profile:read`
- `servers:read`
- `products:read`
- `orders:read`
- `webhooks:manage`

Each `/api/v1/*` route declares and enforces one scope. Per-key rate limits use
`DeveloperApiKey.rateLimitRpm` (default 60/min). Suspended publishers and
applications are rejected. Expired and revoked keys fail closed with a generic
auth error.

Sandbox keys work immediately. Production keys are refused until staff approval.

## Webhooks

Register HTTPS endpoints for:

- `order.created`
- `order.completed`
- `order.refunded`
- `product.updated`
- `server.status_changed`

Payloads are versioned (`version: 1`). Delivery headers:

- `X-KOBA-Timestamp`
- `X-KOBA-Signature` (HMAC-SHA256 of `timestamp.body`)
- `X-KOBA-Delivery`
- `X-KOBA-Event`

Replay window is 5 minutes. Signing secrets are encrypted with
`KOBA_CREDENTIAL_ENCRYPTION_KEY` (AES-256-GCM) and never logged.

SSRF controls: HTTPS only, reject loopback / private / link-local / multicast /
metadata, DNS revalidation via the existing hostname allowlist, `redirect: error`,
10s timeout, 4KB response cap.

Retries: exponential backoff, max 6 attempts. Duplicate event+payload hashes are
not queued twice. Manual redelivery creates a new delivery ID.

Worker:

```bash
pnpm developers:webhooks
DEVELOPER_WEBHOOK_WORKER_LOOP=true pnpm developers:webhooks
```

Queue is PostgreSQL `DeveloperWebhookDelivery.version` claims (same pattern as
Aiden). Redis is not used for this queue.

Local development still rejects `localhost` webhook URLs. Use a public HTTPS
tunnel.

## Products, versions, artifacts

Workflow: `DRAFT` → `SUBMITTED` → `IN_REVIEW` → `APPROVED` → `PUBLISHED`
(plus `CHANGES_REQUESTED`, `REJECTED`, `SUSPENDED`, `ARCHIVED`). Only
`PUBLISHED` listings are public.

Artifacts are private (`developers/{userId}/{versionRef}/…` in S3/R2, or inline
bytes when object storage is unset). Allowlisted types: zip/gz/tgz/tar/json/txt/md,
25MB max. Client MIME/extension is not trusted alone. Released artifacts stay
immutable; staff approve versions out of quarantine.

Downloads use a 120-second signed URL after entitlement checks, or an
authenticated byte response when storage is inline.

`DEV_MALWARE_SCAN_URL` is a hook only. Scanning is **not active** in this MVP.

## Purchases and entitlements

Paid products debit KOBA Coins with `spendCoinsSplit`. Price is read from the
database, not the client. Accounting uses BigInt. Platform commission:

- `KOBA_DEV_COMMISSION_BPS` (fallback `KOBA_COMMISSION_BPS`, default 800)
- `KOBA_DEV_COMMISSION_BPS_VERIFIED` for verified publishers

Seller proceeds credit the **EARNED** bucket. Cash withdrawal is not enabled;
proceeds are non-withdrawable in this phase.

Rules: seller cannot buy their own product; existing entitlements are not charged
again; `COMING_SOON` cannot be purchased; suspended products block new buys.

Staff refunds reverse the ledger when seller `earnedBalance` still covers
proceeds. If proceeds cannot be recovered, the buyer is credited from treasury
and `proceedsUnrecoverable` is set. Negative wallet balances are not created.
Subscriptions are out of scope.

There is no KOBA Coin ↔ fiat conversion.

## Recovery

- Rotate a leaked API key from the portal (old prefix is revoked).
- Rotate a webhook secret (new secret shown once).
- Re-run `pnpm developers:webhooks` if deliveries are stuck `PENDING`.
- Staff can suspend a publisher (revokes application access) or a product
  (blocks purchases; downloads blocked while suspended).

Never commit real secrets. Copy `.env.example` and fill local values only.
