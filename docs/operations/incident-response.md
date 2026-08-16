# Incident response

This is an operational playbook, not a substitute for legal or on-call contracts.

## Severity

| Severity | Examples                                                                                        | First action                                                                 |
| -------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| SEV-1    | Checkout/webhook down, ledger invariant, readiness 503 in production, Stripe live-mode incident | Stop writes if money is wrong; page owner; preserve logs                     |
| SEV-2    | Worker loop down, RCON spike, storage 5xx, Plus reconcile drift                                 | Disable the failing worker loop if it is poisoning state; keep serving reads |
| SEV-3    | Elevated validation noise, single-node Redis fallback                                           | Track; no customer-facing change                                             |

## Identify

1. Take the user-facing `koba_err_*` or `x-request-id` from the client/support ticket.
2. Search structured logs for `errorId` / `requestId` / `correlationId`.
3. If Sentry is configured, search the same tags. If Sentry is unset, logs are the source of truth.
4. Do **not** paste request bodies, cookies, TOTP codes, DMs, or provider payloads into tickets or chat.

## Contain

- Stripe webhook: see `runbooks/stripe-webhook-failure.md`.
- Workers: see `runbooks/worker-failure.md`.
- Application 5xx: see `runbooks/application-errors.md`.
- Ledger `UNBALANCED`: freeze coin grants/spends until the posting path is understood. Do not "fix" balances by hand without a compensating journal.

## Communicate

Until Phase 15F publishes customer policies, internal notes only. Do not invent a public status page.

## After

Record: start/end time, error IDs (not PII), whether money moved, whether a refund/replay is required. Backup/restore remains a Phase 15E gap — do not claim a restore drill happened.
