# Aiden AI generation

Aiden is KOBA’s AI asset-generation system. This phase is an asynchronous
**concept-image MVP**. Output is a private creative draft. It is **not**
game-ready, not auto-listed, and not claimed compatible with any game.

## What is active

| Generation type                                   | Status                        |
| ------------------------------------------------- | ----------------------------- |
| `CONCEPT_IMAGE`                                   | Active                        |
| Skin / texture / prop / animation / terrain / map | Domain reserved, not runnable |

Readiness labels in use:

- `CONCEPT` / `CONCEPT_ONLY` — draft still
- `PREVIEW`
- `REQUIRES_CONVERSION`
- `VALIDATION_FAILED`
- `APPROVED_FOR_MARKETPLACE` — staff review only; still not a listing
- `GAME_READY` — reserved for a later conversion pipeline

## Data flow

1. Authenticated owner submits a prompt and settings at `/aiden/create`.
2. Server validates length, generation type, and prompt moderation.
3. Pricing service estimates KOBA Coins (integer/BigInt only).
4. The existing ledger **reserves** that amount (`reserveCoins`).
5. An `AidenJob` is inserted in `QUEUED` (PostgreSQL is the queue).
6. `pnpm aiden:worker` claims jobs with an optimistic `version` update.
7. The configured provider adapter runs **outside** the HTTP request.
8. Output bytes are downloaded with SSRF protections, sniffed for MIME, and size-checked.
9. Bytes are stored privately (S3/R2 if configured, otherwise inline on the job).
10. Actual provider usage is reconciled: capture actual cost, release unused reserve.
    Unexpected overruns fail the job and release the reservation unless
    `AIDEN_ALLOW_COST_OVERRUN=true`.
11. A private `AidenAsset` appears in `/aiden/library`.
12. The owner may submit it for marketplace **review**. Staff can approve or
    reject the review. That never creates a Product listing.

Job states: `DRAFT` → `QUEUED` → `PROCESSING` → `MODERATING` → `SUCCEEDED` /
`FAILED` / `CANCELLED`. Invalid transitions throw.

## Provider abstraction

`features/aiden/lib/provider.ts` defines `submit`, `retrieve`, usage, and
idempotent request ids.

This phase ships a **deterministic mock provider** (1×1 PNG, 40 Coin usage).
No paid vendor adapter is wired. If `AIDEN_PROVIDER` is not `mock` and
`AIDEN_PROVIDER_API_KEY` is unset or a placeholder, the mock stays in use.

To add a real provider later:

1. Implement `AidenGenerationProvider`.
2. Keep secrets server-side (`AIDEN_PROVIDER_API_KEY`).
3. Verify callbacks with `AIDEN_PROVIDER_WEBHOOK_SECRET` before trusting them.
4. Never trust provider URLs, MIME types, filenames, or usage totals.

Provider callbacks are **rejected** until a real verifier is implemented.
`verifyAidenProviderCallback` currently returns false.

## Queue choice

KOBA already uses PostgreSQL and an optional Upstash Redis REST client for
**rate limits**. There is no Redis job queue in the stack.

Aiden uses the same pattern as the Rust integration worker: a table of jobs,
`runAfter`, `claimedAt`, `version`, and `updateMany` claims. That is the
smallest maintainable option for a single VPS. Do not add a broker for this MVP.

## Worker

```bash
pnpm aiden:worker
AIDEN_WORKER_LOOP=true pnpm aiden:worker
```

- Bounded concurrency (2) and batch size (8)
- Retry with exponential backoff and `maxAttempts` (3)
- Stale `PROCESSING` rows older than two minutes are reclaimable
- SIGINT/SIGTERM stop the loop after the current batch
- Structured JSON logs include health without secrets

### Recovery

1. Confirm the worker process or cron is running.
2. Inspect `AidenJob` rows in `QUEUED` / `PROCESSING` with a past `runAfter`.
3. Re-run `pnpm aiden:worker`. Stale claims are recovered by version.
4. Terminal `FAILED` / `CANCELLED` jobs release their coin reservation
   idempotently. Do not manually capture a reservation for a failed job.
5. Duplicate worker processes cannot double-charge: settle/release keys are
   `aiden-settle:{publicRef}` and `aiden-failed-release:{publicRef}`.

## Pricing

Do not hardcode business prices in UI components. The estimate API reads:

| Variable                                 | Default | Meaning                |
| ---------------------------------------- | ------- | ---------------------- |
| `AIDEN_PRICE_CONCEPT_IMAGE`              | 40      | Base concept cost      |
| `AIDEN_PRICE_CONCEPT_IMAGE_HD_SURCHARGE` | 20      | Added for `hd` quality |
| `AIDEN_PRICE_LARGE_SURCHARGE`            | 15      | Added above 1024² px   |
| `AIDEN_ALLOW_COST_OVERRUN`               | false   | Reject provider excess |

## Storage

Private by default. Uploads use `PutObject` without a public ACL. Previews use
short-lived signed GET URLs (120s) or an authenticated
`GET /api/aiden/library/[ref]/media` stream when S3 is not configured.

## Moderation and malware

- Prompt blocklist: built-in patterns plus optional `AIDEN_PROMPT_BLOCKLIST`
- Output moderation state is stored (`CLEAR` / `FLAGGED` / `BLOCKED`)
- Malware scanning is a **hook only**. It is **not active** unless a scanner is
  implemented against `AIDEN_MALWARE_SCAN_URL`. Do not claim scanning is on.

Prompts are owner-private. Staff review queues do not display the prompt.

## Routes

| Path                                    | Purpose                         |
| --------------------------------------- | ------------------------------- |
| `/aiden`                                | Landing                         |
| `/aiden/create`                         | Queue a concept job             |
| `/aiden/jobs/[jobId]`                   | Status, cancel, preview         |
| `/aiden/library`                        | Private library + review submit |
| `POST /api/aiden/estimate`              | Cost + wallet preview           |
| `POST /api/aiden/jobs`                  | Create (idempotent)             |
| `PATCH /api/aiden/jobs/[ref]`           | Cancel                          |
| `POST /api/aiden/library/[ref]/publish` | Submit for review               |
| `GET /api/admin/aiden/pending`          | Staff queue                     |
| `POST /api/admin/aiden/[ref]`           | Staff approve/reject review     |

`/aiden/generate` redirects to `/aiden/create`.

Sensitive Aiden APIs are `Cache-Control: no-store` and excluded from the PWA cache.
