# Runbook — worker failure

## Symptoms

- Alert `job_terminal_failure`, `rcon_failure_spike`, `payment_reconciliation_mismatch`
- Log events `worker_start`, `worker_heartbeat`, `worker_stop`, `worker_inactive_loop`
- Cron exit non-zero (missing `DATABASE_URL` / encryption key / Stripe test secret)

## Facts

Workers are **opt-in loops**. Default is a single batch (cron-friendly). `*_WORKER_LOOP=true` keeps the process alive with SIGINT/SIGTERM shutdown.

Heartbeats live in the worker process only. The Next.js app **cannot** honestly say a VPS cron is healthy.

Auction settlement runs inside web requests (`settleExpiredAuctions`), not a dedicated worker.

## Checks

1. Confirm which script: Aiden, server poll, RCON, developer webhooks, influencer payouts, promotions, Plus reconcile.
2. Read the last `worker_heartbeat` / `job_success` / `job_terminal_failure` line (JSON in production).
3. For Aiden / developer webhooks, inspect job `FAILED` / `attempts` vs `maxAttempts` in Postgres — not in logs of payloads.
4. For RCON, confirm `KOBA_CREDENTIAL_ENCRYPTION_KEY` is set; never print it.
5. For Plus reconcile, `aligned: false` means Stripe vs local drift — do not write local state back to Stripe.

## Actions

- Stop a looping worker (`SIGINT`) if it is retrying poison messages.
- Re-run a one-shot batch after the code/data fix: `pnpm aiden:worker` (etc.).
- Exhausted retries stay `FAILED` until a human inspects. Do not reset `attempts` blindly on money jobs (influencer payouts, Plus).

## Related

- `docs/operations/observability.md`
- `docs/operations/runbooks/stripe-webhook-failure.md`
