# common

Cross-cutting backend concerns shared by every module in `../modules/`:

- Auth guard (validates the active KOBAID + role on each request)
- RBAC decorator/guard (Phase 11 — Superadmin/Admin/Moderator staff checks)
- Tagging-permission interceptor (Phase 6 — reused by marketplace, shops, groups)
- Stripe webhook verification middleware (Phase 3/4/10)
- `tdls/` — TDLS (Trusted Data Link Security), ephemeral-symmetric-key
  envelope encryption (AES-256-GCM) for secure transport between sandboxed
  functions/services. Implements the client's answer to the KOBAID
  module's former `TODO(TDLS)`. See `tdls/README.md`.
