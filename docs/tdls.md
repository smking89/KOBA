# TDLS — Transport Discipline Layer System

TDLS is KOBA's trust-boundary enforcement layer: a universal discipline
(encryption/signing where a network hop actually happens, schema
validation, replay protection, tamper-evident logging, and superadmin
kill switches) applied at the points where untrusted or high-privilege
input crosses into the platform — not a claim that every in-process
function call between modules in the same Node process is individually
encrypted.

That distinction matters. KOBA today runs as a single Next.js server
process. Master → Orchestration → Category → Agent calls inside Aiden
Studio OS are in-memory function calls with no network hop to intercept —
"encrypting" them would be theater, not security. The trust boundaries
that are real, and that TDLS actually defends, are:

- **External entry**: a request arriving from outside the process
  (browser → API route, superadmin dashboard actions, webhooks).
- **External adapter calls**: a KOBA service calling out to a third-party
  API (Stripe, Claude, and future Aiden vendors like Tripo/Hunyuan/Luma).
- **Superadmin configuration changes**: anything that changes what the
  platform is allowed to do at runtime.

This doc tracks TDLS as it's actually built, in slices — not as a single
big-bang project. Each slice below is real and shipped; nothing here is
aspirational copy for something that doesn't exist yet.

## Slice 1 — Superadmin platform function control (shipped)

A DB-backed kill switch per major platform function
(`PlatformFunctionKey` enum in `prisma/schema.prisma`), gated to
`SUPERADMIN` only (`canManagePlatformFunctions` in
`features/platform-control/lib/functions.ts` — deliberately narrower than
the SA/AD pattern used for shop verification, since this can stop money
movement platform-wide, not just resolve one transaction).

- `features/platform-control/services/platform-function.service.ts`:
  `listPlatformFunctions`, `setPlatformFunctionEnabled`,
  `isPlatformFunctionEnabled`. The runtime check fails **closed** — a DB
  error is treated as disabled, not enabled, because a silent bypass on
  an outage is worse than a false block on a guard protecting real money
  and API-cost paths.
- A function absent from the `PlatformFunctionFlag` table defaults to
  **enabled** — shipping a new function never requires a migration to
  turn it on; only an explicit superadmin action turns one off.
- Wired today at two real enforcement points:
  `features/payments/services/checkout.service.ts` (`STRIPE_PAYMENTS`)
  and `features/shops/services/product-description-assist.service.ts`
  (`CLAUDE_DESCRIPTION_ASSIST`). The remaining registry entries
  (`AIDEN_GENERATION`, `SOCIAL_POSTING`, `MESSAGING`, `TRADE`,
  `MARKETPLACE_CHECKOUT`, `SERVER_RCON`, `PLUS_SUBSCRIPTIONS`) are
  registered and toggleable from the admin panel but not yet enforced at
  their call sites — that's follow-up work, not a gap in the switch
  itself.
- Every toggle writes an `AuditLog` row (`PLATFORM_FUNCTION_ENABLED` /
  `PLATFORM_FUNCTION_DISABLED`) via the hash-chained `writeAuditLog`
  below, so "who disabled what, when, and why (note field)" is always
  reconstructable.
- Admin UI: `/admin` → "Platform functions" card
  (`features/platform-control/components/platform-functions-panel.tsx`),
  visible only to SUPERADMIN.

## Slice 1b — Tamper-evident audit log (shipped)

`features/auth/services/audit-log.service.ts` now chains every
`AuditLog` row's hash to the previous row's hash
(`prevHash`/`hash` columns, SHA-256, `computeAuditHash`). Editing or
deleting a past row breaks every hash after it; `verifyAuditChain()`
replays the log and reports the first broken link, if any. Writes take a
Postgres advisory lock (`pg_advisory_xact_lock`) so concurrent writers
can't fork the chain. Rows written before this shipped have null
`prevHash`/`hash` and are treated as outside the verifiable chain, not as
tampered — the chain is considered to start fresh at the first non-null
row.

This is what "anti-tamper" means in TDLS today: a database-level
detection mechanism for the audit trail, not a cryptographic proof over
every packet in the system.

## Not yet built — deferred, not implemented under a guess

The following ideas from the original TDLS spec are real, well-scoped
future slices, not things silently skipped:

- **Signed/replay-protected envelopes for external adapter calls.**
  HMAC-sign outbound requests to Stripe/Claude/future Aiden vendors with
  a nonce + timestamp, so a captured request can't be replayed. Slice 2.
- **Per-category module isolation as an access-control property**
  (a category's code can only reach its own adapters/DB models/API
  keys, enforced by import-boundary lint rules + explicit capability
  injection) — access-control isolation, not OS-level process
  sandboxing. True process/VM-level sandboxing (e.g. for arbitrary
  user-uploaded local models) is a separate infra project (gVisor/
  Firecracker/worker processes) with its own scope and cost, and isn't
  planned unless that specific need (untrusted local model execution)
  materializes.
- **Enforcing the remaining `PlatformFunctionKey` values** at their
  actual call sites (Aiden job submission, social posting, messaging,
  trade, marketplace checkout, server RCON, Plus checkout) — the switch
  exists and is toggleable; wiring is incremental.
