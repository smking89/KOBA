# Observability (Phase 15D)

KOBA records operational signals in three layers:

1. **Structured logs** (`lib/observability/logger.ts`) — JSON in production (`NODE_ENV=production` or `KOBA_LOG_JSON=true`), readable lines in local development.
2. **Sentry** (`@sentry/nextjs`) — optional. Missing DSN, placeholder DSN, `SENTRY_ENABLED=false`, or `NODE_ENV=test` leave capture disabled. The app must build and run without a Sentry project.
3. **Named alert events** (`lib/observability/alerts.ts`) — bounded labels only (`worker`, `operation`, `provider`, `outcome`, `errorClass`). Never user IDs, URLs, or raw error strings as metric labels.

Session replay is **disabled** (`replaysSessionSampleRate` / `replaysOnErrorSampleRate` = 0). Do not enable replay on DMs, wallet, checkout, admin, MFA, RCON, developer secrets, or private Aiden prompts.

## Request and correlation IDs

Middleware mints or accepts `x-request-id` (charset `[A-Za-z0-9._-]`, length 8–128). Invalid or oversized upstream values are discarded to prevent header injection. The same ID is returned on the response.

Workers mint `cor_*` correlation IDs per batch and propagate them into:

- developer webhook deliveries (`X-KOBA-Correlation-Id`)
- RCON / integration attempts
- Aiden job processing context
- Sentry tags when capture is enabled

Unexpected failures also receive a user-facing `koba_err_*` id (`x-koba-error-id`) without exposing the original cause in production.

## Redaction

`redactValue` recursively strips secrets, tokens, cookies, TOTP/recovery material, Stripe keys, RCON credentials, signed URLs, private prompts, and DM-shaped keys. Request bodies are never attached to Sentry events (`beforeSend` deletes `request.data`).

## Health and readiness

| Endpoint          | Meaning                                                                  | Failure                           |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `GET /api/health` | Process liveness. `?deep=1` also pings Postgres.                         | 503 if the deep DB ping fails     |
| `GET /api/ready`  | Bounded Postgres ping, Redis when configured, required production config | 503 if a **required** check fails |

Both send `Cache-Control: no-store`. Optional services (Sentry, email, object storage, Aiden provider, RCON encryption) report `configured` / `unset` / `degraded` and do **not** fail readiness by themselves.

Responses must not include credentials, connection strings, internal hostnames, stack traces, or queue payloads.

## Workers

Entry scripts wrap `runWorkerMain`:

| Script                      | Worker name          | Loop env (default off)          |
| --------------------------- | -------------------- | ------------------------------- |
| `pnpm aiden:worker`         | `aiden`              | `AIDEN_WORKER_LOOP`             |
| `pnpm servers:poll`         | `server-poll`        | `SERVER_POLL_WORKER_LOOP`       |
| `pnpm servers:integrations` | `rcon-integration`   | `RUST_INTEGRATION_WORKER_LOOP`  |
| `pnpm developers:webhooks`  | `developer-webhooks` | `DEVELOPER_WEBHOOK_WORKER_LOOP` |
| `pnpm influencer:payouts`   | `influencer-payouts` | `INFLUENCER_PAYOUT_WORKER_LOOP` |
| `pnpm promotions:worker`    | `promotions`         | `PROMOTIONS_WORKER_LOOP`        |
| `pnpm plus:reconcile`       | `plus-reconcile`     | `PLUS_RECONCILE_WORKER_LOOP`    |

Auction settlement is request-driven (`settleExpiredAuctions`); it is instrumented but is **not** a dedicated worker. Heartbeats are **in-process**. Do not treat another machine's workers as healthy because this process's map is empty. If a loop env is false, logs record `worker_inactive_loop` after the cron-style one-shot batch.

## Alert conditions (configure in Sentry / log drain)

| Event                             | When                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `http_5xx_rate`                   | ≥20 unexpected 5xx in 60s (process-local window)           |
| `readiness_failure`               | `/api/ready` not ready                                     |
| `database_failure`                | Ready ping cannot reach Postgres                           |
| `redis_failure`                   | Upstash ping or repeated rate-limit REST failures          |
| `worker_heartbeat_missing`        | Reserved for a future shared store (in-process only today) |
| `queue_backlog`                   | Worker batch reports `queueDepth` ≥ 50                     |
| `job_terminal_failure`            | Worker batch threw or contained FAILED jobs                |
| `stripe_signature_rejected`       | Webhook `INVALID_SIGNATURE`                                |
| `stripe_webhook_failure`          | Webhook handler 500                                        |
| `payment_reconciliation_mismatch` | Plus reconcile drift                                       |
| `refund_failure`                  | Stripe `refunds.create` threw                              |
| `ledger_invariant_failure`        | Unbalanced ledger post                                     |
| `staff_mfa_failure_spike`         | ≥12 invalid MFA codes in 60s                               |
| `rcon_failure_spike`              | ≥8 failed RCON refreshes in 60s                            |
| `storage_failure`                 | Presign / object storage error                             |
| `backup_failure_placeholder`      | **Not operational.** Phase 15E owns backups.               |

## Admin operations view

**Deferred.** An `/admin/operations` dashboard would need a shared heartbeat store (Redis/Postgres) to be honest across web and worker processes. Shipping an in-memory view from the Next.js server would misreport worker health. Staff can use `/api/ready` plus log/Sentry search until 15E.

## External setup still required (owner)

1. Create a Sentry project (or equivalent) for this Next.js 15 App Router app.
2. Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser) to real ingest URLs — never commit them.
3. Set `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` (git SHA), and optionally `SENTRY_TRACES_SAMPLE_RATE` (0–1).
4. Source-map upload: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on CI/VPS only. Tokens must not reach the browser bundle.
5. Create alert rules for the event names above. Until that project exists, Sentry remains **NOT VERIFIED**.
