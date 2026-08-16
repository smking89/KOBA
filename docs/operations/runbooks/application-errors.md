# Runbook — application errors

## Symptoms

- Generic production body `{ "error": "Something went wrong.", "errorId": "koba_err_…" }`
- `x-koba-error-id` / `x-request-id` on the response
- Log event `unexpected_error` or alert `http_5xx_rate`

Expected 4xx (validation, authn/z, not found, rate limit, Stripe signature rejection) are **not** critical pages. They are filtered from Sentry via `shouldDropError`.

## Checks

1. `GET /api/health` — process up?
2. `GET /api/ready` — Postgres / required config / Redis-if-configured?
3. Search logs for the `errorId`. The original cause stays server-side.
4. Confirm the failure is not a known user error (`errorClass` in `validation` / `authentication` / `authorization` / `not_found` / `conflict` / `rate_limited` / `security_rejection`).

## Actions

- If readiness fails, treat as SEV-1 for production traffic.
- If only a single route 500s, keep the rest of the site; fix the handler. Unexpected JSON errors are captured once per request context (`wasCaptured`) to avoid duplicate Sentry events.
- Never attach raw request bodies to a new Sentry event or ticket.

## Related

- `docs/operations/observability.md`
- `docs/operations/runbooks/stripe-webhook-failure.md`
