# Runbook — Stripe webhook failure

## Symptoms

- Alert `stripe_signature_rejected` (HTTP 4xx, `INVALID_SIGNATURE`)
- Alert `stripe_webhook_failure` (HTTP 500 from `/api/stripe/webhook`)
- Plus UI stuck on “waiting for verified Stripe webhook”
- Checkout paid in Stripe but order not `PAID`

## Checks

1. Confirm `STRIPE_WEBHOOK_SECRET` is the **signing secret for this endpoint**, not the Stripe secret key.
2. Confirm the endpoint URL hits this KOBA app, not another process on port 3000.
3. Search logs for `stripe_webhook_received` vs `stripe_signature_rejected` / `stripe_webhook_failure`. Event **type** may be logged; **never** log the raw body or `Stripe-Signature` header.
4. In Stripe Dashboard, inspect the event delivery. Replay only after signature verification succeeds locally.

## Actions

- Signature rejection: fix the secret/endpoint. Do not disable verification.
- Handler 500: use `x-request-id` / `errorId`. Fix the handler; then replay the event from Stripe (idempotent order transitions already exist for paid/refunded).
- Plus drift after a missed invoice event: `pnpm plus:reconcile` (test-mode secret required). Alert `payment_reconciliation_mismatch` if rows stay unaligned.
- Refunds: `refund_failure` means `refunds.create` threw — do not mark the order refunded locally until Stripe confirms.

Live-mode charges are still blocked. Do not set folklore `STRIPE_ALLOW_LIVE` flags as a fix.

## Related

- `docs/operations/observability.md`
- `docs/operations/runbooks/application-errors.md`
