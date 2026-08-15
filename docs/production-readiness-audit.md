# KOBA production-readiness audit

**Phase:** 15A — inspect, test, classify, and document. No production code, schema, secrets, or infrastructure was changed.

| Field                       | Value                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Audit date                  | 2026-08-15                                                                                                   |
| Branch                      | `docs/production-readiness-audit` (not `main`)                                                               |
| HEAD                        | `010495f` `feat(promotions): add influencer referrals and sponsored campaigns`                               |
| `origin/main`               | `86f6b77` `fix(pwa): self-heal stale service worker registrations in dev; rewrite homepage copy`             |
| Divergence                  | **83 commits ahead** of `origin/main`, 0 behind                                                              |
| Phase 14I                   | **Completed and committed** on `feat/influencer-promotions`, then this docs branch was created from that tip |
| Working tree at audit start | Clean (no unrelated uncommitted product changes)                                                             |
| License                     | `LICENSE` remains **All Rights Reserved**, copyright 2026 KOBA — unaltered                                   |
| This report                 | Evidence-based. Missing verification is marked `NOT VERIFIED`. Secret values are never printed.              |

Companion machine-readable file: [`docs/production-readiness-findings.json`](./production-readiness-findings.json).

---

## 1. Executive summary

KOBA is a substantial Next.js 15 application with PostgreSQL/Prisma, Auth.js, Stripe **test-mode** payments, a KOBA Coins ledger, marketplace/auctions, social/DMs, server directory + RCON, Aiden (mock AI), a developer portal, and influencer promotions. Unit tests, lint, typecheck, Prisma validate/generate, and production build **passed** on this machine. That is not the same as being ready to take real customers or real money.

Independent launch statuses:

| Level                    | Status                    | Why, in one sentence                                                                                                                                           |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal development     | **READY WITH CONDITIONS** | App builds and 301 unit tests pass; local env is incomplete, seed staff password exists, and `pnpm format:check` fails on pre-existing CRLF.                   |
| Staging deployment       | **READY WITH CONDITIONS** | A Stripe-test staging instance can be stood up from this branch, but the repo has no deploy image, proxy, backup, worker supervisor, or staging env contract.  |
| Closed beta              | **NOT READY**             | Staff MFA, backups, legal pages, observability, login hardening, and seed-credential guards are missing.                                                       |
| Public production launch | **NOT READY**             | All closed-beta blockers plus PWA cache/logout gaps, malware-scan absence on archives, nested `sharp` HIGH advisory, and 83 unmerged commits vs `origin/main`. |
| Real-money transactions  | **NOT READY**             | Live Stripe keys are rejected by design; financial alerting is absent; ledger concurrency is not proven against a live database in this audit.                 |

Do not treat Stripe test-mode quality as live-mode proof. Do not treat `origin/main` as the product: Phases 14B–14I exist only on the local stacked feature history.

**Recommended next phase:** **15B — critical security and authorization hardening** (open redirect, client-writable JWT `accountType`, seed SUPERADMIN guard, login rate limits, security headers). MFA and admin session work belong in 15C once those holes are closed.

---

## 2. Current architecture

What exists in **this repository**, not the intended roadmap.

### 2.1 Component inventory

| Component                            | Purpose                                                   | Implementation status                                     | Production dependency                          | Failure impact                                  | Current recovery                               | Owner / role     |
| ------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ---------------- |
| Next.js 15 App Router                | Web UI, Route Handlers, middleware                        | Implemented                                               | Node 20+, `AUTH_SECRET`, `DATABASE_URL`        | Site down                                       | Process restart (not defined in repo)          | Platform         |
| API routes + server services         | Domain mutations                                          | Implemented                                               | Same + feature env                             | Feature outage                                  | Retry; no request IDs                          | Feature owners   |
| PostgreSQL 16 + Prisma 7             | System of record                                          | Implemented (20 migrations)                               | Reachable Postgres                             | Total outage; money/identity loss if unrestored | None documented                                | Platform / DBA   |
| Auth.js credentials + JWT            | Login, 30-day sessions                                    | Implemented                                               | `AUTH_SECRET` ≥ 32 in `getServerEnv()`         | Auth down or unsigned sessions                  | Restart with secret                            | Security         |
| KOBAID + account switch              | Player / Business / Influencer identities                 | Implemented                                               | DB                                             | Mode/tools wrong                                | Re-switch via `/api/accounts/switch`           | Identity         |
| Stripe Checkout + Connect            | Marketplace checkout, seller payouts                      | Implemented, **test keys only**                           | `sk_test_`, webhook secret                     | Checkout disabled (fail-closed)                 | Reconfigure test keys                          | Payments         |
| Stripe Billing (Plus)                | Optional membership                                       | Implemented, test mode                                    | Plus Price IDs                                 | Plus stuck                                      | `pnpm plus:reconcile`                          | Payments         |
| KOBA Coins ledger                    | Integer/BigInt double-entry                               | Implemented                                               | DB transactions + `FOR UPDATE`                 | Wallet wrong or blocked                         | `reconcileWallet` exists in code; no prod job  | Wallet           |
| Auctions                             | Bids, anti-snipe extend, settlement                       | Implemented                                               | DB; **settlement triggered by listing reads**  | Late winner reservation                         | Page view / `getPublicAuction`                 | Marketplace      |
| Item trading                         | Inventory + offers                                        | Implemented                                               | DB                                             | Trades stuck                                    | User retry                                     | Trading          |
| Groups / LFG / social / DMs          | Community + SSE threads                                   | Implemented                                               | DB; SSE to app instance                        | Social/DM outage                                | Reconnect client                               | Social           |
| Redis / Upstash                      | Distributed rate limit                                    | Partially implemented                                     | Optional `UPSTASH_*`                           | Falls back to **in-memory** buckets             | Memory limiter                                 | Platform         |
| Background workers                   | Poll, RCON, Aiden, webhooks, Plus, influencer, promotions | Implemented as `pnpm *` scripts; loops **off** by default | Cron/supervisor + DB + feature secrets         | Jobs stall silently                             | Manual rerun                                   | Ops              |
| Aiden generation                     | Concept images, Coin reservation                          | Partially implemented — **mock provider**                 | Worker + optional vendor key                   | Jobs queue forever without worker               | `pnpm aiden:worker`                            | Aiden            |
| Object storage S3/R2                 | Presigned uploads                                         | Partially implemented                                     | S3 env; fail-closed if unset                   | Media upload disabled                           | Reconfigure bucket                             | Media            |
| Email (Resend)                       | Verify + password reset                                   | Implemented; **production fail-closed**                   | `RESEND_API_KEY`, `EMAIL_FROM`                 | Cannot register/reset in prod                   | Configure Resend                               | Auth             |
| Server directory + A2S poll          | Public query of game servers                              | Implemented + SSRF guards                                 | `pnpm servers:poll`                            | Stale directory                                 | Cron                                           | Servers          |
| Rust RCON                            | Encrypted credentials, read-only ops                      | Implemented                                               | `KOBA_CREDENTIAL_ENCRYPTION_KEY` (fail-closed) | Cannot save/use RCON                            | Configure key; rotate via env                  | Servers          |
| Developer portal / v1 API / webhooks | Apps, keys, signed webhooks                               | Implemented                                               | Encryption key + webhook worker                | Keys/webhooks fail                              | Worker + key rotation APIs                     | Developers       |
| Influencer / promotions              | Referrals, promo, ads, commissions                        | Implemented                                               | Promotions + payout workers; Stripe test       | Commissions stale                               | `pnpm promotions:worker`, `influencer:payouts` | Promotions       |
| Staff admin console                  | Moderation, refunds, grants                               | Implemented (DB staff identities)                         | Session + staff KOBAID                         | Queue unusable                                  | Issue staff ID from existing SA                | Staff            |
| PWA / Serwist                        | Install, offline page, caching                            | Implemented                                               | HTTPS in prod                                  | Stale/private cache risk                        | Unregister SW (dev self-heal only)             | Frontend         |
| Health `GET /api/health`             | Liveness; `?deep=1` DB ping                               | Implemented                                               | Public HTTP                                    | False healthy if shallow                        | N/A                                            | Ops              |
| Observability (Sentry/APM)           | Error + payment alerting                                  | **Missing**                                               | —                                              | Silent financial/job failure                    | Console logs only                              | Ops              |
| Reverse proxy / TLS / VPS            | HTTPS, firewall, deploy                                   | **Documented only / missing in repo**                     | External                                       | Entire site                                     | External                                       | Ops              |
| Socket.IO / `REALTIME_URL`           | Documented alternative realtime                           | **Documented only**                                       | —                                              | N/A (SSE used)                                  | N/A                                            | —                |
| Malware scanning                     | Aiden + developer artifacts                               | **Hook only; `malwareScanningActive()` always false**     | Optional URL never wired                       | Malicious zip/image accepted                    | Manual staff review                            | Security         |
| Legal / policy site pages            | ToS, privacy, refunds                                     | **Missing** (research notes only)                         | Lawyer-reviewed copy                           | Regulatory/trust failure                        | N/A                                            | Legal            |
| Account deletion / GDPR              | Privacy requests                                          | **Missing**                                               | —                                              | Cannot honour deletion                          | Manual SQL (undefined)                         | Legal / Platform |

### 2.2 Runtime sketch

```
Browser / PWA (Serwist)
  → Next.js (middleware JWT, Route Handlers, RSC)
      → PostgreSQL (Prisma adapter-pg Pool)
      → optional Upstash REST (rate limit)
      → Stripe (test) webhooks → ProcessedStripeEvent claim
      → S3/R2 presign (if configured)
      → Resend (or fail-closed in production)
VPS cron (not in Docker Compose):
  servers:poll, servers:integrations, plus:reconcile,
  aiden:worker, developers:webhooks, influencer:payouts, promotions:worker
```

Docker Compose provides **Postgres 16 only**, published on `5432:5432`, user/password `koba`/`koba`. There is **no application Dockerfile**.

---

## 3. Implemented versus mocked features

| Area                                       | Verdict                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Auth register / verify / login / reset     | Implemented (email fail-closed in production)                                    |
| KOBAID mint / switch / staff issue         | Implemented                                                                      |
| Shops, catalog, checkout, Connect, refunds | Implemented in **Stripe test mode**                                              |
| Auctions + 2-minute anti-snipe             | Implemented; expiry settlement is **request-driven**                             |
| KOBA Coins ledger, Aiden reservation       | Implemented; cash buy/withdraw **deferred**                                      |
| Item trading                               | Implemented                                                                      |
| DMs + SSE                                  | Implemented (`REALTIME_URL` unused)                                              |
| Server poll + SSRF + encrypted RCON        | Implemented                                                                      |
| KOBA Plus                                  | Implemented; `MOCK_PLUS_SUBSCRIPTION` used when logged out or on service error   |
| Aiden                                      | **Mock provider** (`AIDEN_PROVIDER=mock`); paid vendor **not wired**             |
| Developer artifacts                        | Implemented; malware scan **not active**                                         |
| Influencer campaigns / ads / commissions   | Implemented (test-mode payouts)                                                  |
| Staff admin                                | Implemented; **no MFA**                                                          |
| PWA                                        | Implemented                                                                      |
| Sentry                                     | Missing                                                                          |
| Live Stripe                                | **Disabled** (`isStripeConfigured()` requires `sk_test_`; live → `live-blocked`) |
| Coin fiat on-ramp                          | Documented as deferred                                                           |
| Legal pages                                | Missing                                                                          |
| Production backups                         | Missing                                                                          |

---

## 4. Threat model

Methodology: **STRIDE** (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), applied to KOBA-specific assets and trust boundaries.

### 4.1 Assets

User accounts, staff accounts, KOBAID identities, JWT sessions, Coin balances and ledger entries, Stripe objects and Connect earnings, influencer commissions, DMs, uploads, Aiden assets, RCON ciphertext + encryption keys, developer API keys, webhook secrets, game-server endpoints, moderation evidence, audit logs.

### 4.2 Trust boundaries

1. Browser ↔ Next.js (cookies, CSRF, XSS, open redirects)
2. Service worker ↔ cached HTML/API (stale private pages)
3. Next.js ↔ PostgreSQL
4. Next.js ↔ Upstash (optional)
5. Next.js ↔ Stripe
6. Aiden worker ↔ external AI provider (mock today)
7. App ↔ R2/S3
8. Poll worker ↔ game servers (SSRF)
9. RCON worker ↔ remote servers
10. App ↔ developer webhook URLs (SSRF-checked)
11. Staff UI ↔ privileged mutations
12. Reverse proxy ↔ app (**not in repo**)
13. CI/CD ↔ VPS (**not in repo**)

### 4.3 Threat actors

Unauthenticated attacker; malicious user; fraudulent buyer/seller/influencer; malicious developer (artifact/webhook); compromised game server; compromised staff; compromised Stripe/Resend/R2; bots; insider with seed or VPS access.

### 4.4 Major STRIDE mappings

| Threat                                      | STRIDE | Evidence / status                                                                     |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Login CSRF / session fixation               | S      | Auth.js cookies; `trustHost: true`; **NOT VERIFIED** cookie flags in production HTTPS |
| Open redirect after login                   | S      | `callbackUrl` pushed without allowlist — **KOBA-SEC-002**                             |
| Spoof staff in JWT                          | S / E  | `session.update({ accountType })` accepted from client — **KOBA-SEC-004**             |
| Seed SUPERADMIN password                    | E      | `prisma/seed.ts` + README — **KOBA-SEC-001**                                          |
| Staff without MFA                           | E      | No TOTP/WebAuthn anywhere — **KOBA-SEC-003**                                          |
| Brute-force login                           | D / E  | Register/reset limited; **login authorize is not** — **KOBA-SEC-005**                 |
| Ledger double-spend                         | T      | `FOR UPDATE` + unique idempotency; live DB concurrency **NOT VERIFIED** this audit    |
| Webhook replay                              | T      | `ProcessedStripeEvent.eventId` PK + Stripe signature                                  |
| Unsigned live charges                       | T      | Live keys rejected — control                                                          |
| SSRF via server host / Aiden URL / webhooks | I / E  | `features/servers/lib/ssrf.ts`, `assertSafeProviderUrl`                               |
| Malicious zip in developer marketplace      | T / E  | Ext allowlist includes zip/tar; scanner inactive — **KOBA-MED-001**                   |
| Private pages in SW cache                   | I      | Navigation `NetworkFirst` — **KOBA-PWA-001**                                          |
| Tamper audit log                            | R      | `AuditLog` has no integrity chain                                                     |
| Exhaust SSE / poll / unauthenticated health | D      | Public health; SSE unbounded per instance — **NOT VERIFIED** at scale                 |
| Insider runs seed in production             | E      | No `NODE_ENV` guard around staff upsert                                               |

---

## 5. Findings by severity

Severity is not inflated: a theoretical issue without a demonstrated path is not automatically `CRITICAL`. No `CRITICAL` findings were proven in this pass. Several **HIGH** items are still **public-launch blockers** under the Phase 15A rules.

### 5.1 HIGH

#### KOBA-SEC-001 — Seeded SUPERADMIN password is documented and reset on every seed

- **Category:** Secrets / authorization
- **Confidence:** High
- **Component:** `prisma/seed.ts`, `README.md`
- **Evidence:** Seed hashes `"KobaStaff1!"` for `staff@koba.local`, **upserts and overwrites `passwordHash`**, logs the password. Coin grants are wrapped in `NODE_ENV !== "production"`; the staff user is **not**. README documents the same login.
- **Impact:** Anyone who can run `pnpm db:seed` against a deployed database resets a SUPERADMIN password to a public value. Combined with no login rate limit, this is a trivial staff takeover if seed ever runs in staging/prod.
- **Remediation:** Refuse seed in production; never upsert a known password; generate a one-time staff invite instead.
- **Validation:** Attempt seed with `NODE_ENV=production` against a throwaway DB; confirm abort and no staff upsert.
- **Launch-blocking:** Yes (public, closed beta, real-money). Staging if seed is part of deploy.
- **Phase 15B status: RESOLVED.** `lib/security/seed-guard.ts` aborts seeding when `NODE_ENV=production` (no override); `prisma/seed.ts` never resets an existing staff password and generates a random (or `SEED_STAFF_PASSWORD`) value printed once on first seed only; README updated. Tests: `tests/unit/security-hardening.test.ts` ("KOBA-SEC-001 seed guard"). Residual: existing local databases seeded before this fix still hold the old password — rotate locally.

#### KOBA-SEC-002 — Open redirect after login

- **Category:** Unsafe redirects
- **Confidence:** High
- **Component:** `features/auth/components/login-form.tsx`
- **Evidence:** `callbackUrl = searchParams.get("callbackUrl") ?? "/enter"` then `router.push(callbackUrl)` with no same-origin / path allowlist. Middleware also copies `pathname` into `callbackUrl` (internal paths only there). Login form accepts **any** query value, including `https://evil.example`.
- **Impact:** Phishing: victim logs into KOBA then is sent to an attacker site while authenticated in the original origin.
- **Remediation:** Allow only relative paths starting with `/` and not `//`, or a fixed prefix list.
- **Validation:** ` /login?callbackUrl=https://example.com` must ignore the host.
- **Launch-blocking:** Yes (public, closed beta).
- **Phase 15B status: RESOLVED.** `lib/security/safe-redirect.ts` (`safeInternalPath`) only honours single-slash relative paths without backslashes or control characters; the login form now routes through it. Tests: "KOBA-SEC-002 safe redirect" (absolute URL, `//host`, `/\host`, control characters, empty). Residual: none identified.

#### KOBA-SEC-003 — No staff MFA; all privileged workflows are password-only

- **Category:** Authentication
- **Confidence:** High
- **Component:** Auth, `/admin`, refunds, Connect, RCON, API keys, grants
- **Evidence:** Repo-wide search for `mfa` / `totp` / `2fa` / `webauthn` returned **no matches**. Admin page uses session + DB staff identities only.
- **Privileged workflows without MFA:** staff login; issue SA/AD/MD KOBAIDs; staff refunds; listing/shop/server/Aiden/developer/promotion moderation; Plus promotional grants; RCON credential save/test; developer API key create/rotate; webhook secret reveal; Connect onboarding; influencer verify/suspend.
- **Impact:** Stolen staff password (or seed password) is full platform control.
- **Remediation:** Phase 15C — mandatory WebAuthn or TOTP for staff types; step-up for refunds and credential views.
- **Validation:** Staff routes return 403 without a verified second factor.
- **Launch-blocking:** Yes (public, closed beta, real-money).

#### KOBA-SEC-004 — Client can write `accountType` into the JWT

- **Category:** Broken access control (session integrity)
- **Confidence:** High
- **Component:** `lib/auth/edge.config.ts`, `features/koba-id/components/koba-id-reveal.tsx`, `features/accounts/components/account-mode-switch.tsx`
- **Evidence:** JWT `update` callback copies `session.accountType` from the client. Intended callers pass server snapshots, but Auth.js `update()` is client-reachable. Admin **APIs** load staff from DB (`requireAnyStaff`); header staff link trusts `session.user.accountType`. Server create APIs use `getAccountSnapshot`, not the JWT claim.
- **Impact:** Demonstrated path to **spoof staff chrome** and any future code that trusts JWT `accountType`. Current admin mutations appear DB-gated (reduces severity from critical). Still a launch blocker because it is broken session authorization waiting to be wired incorrectly.
- **Remediation:** Ignore client-supplied `accountType` / `kobaId`; refresh claims only from DB in a server callback.
- **Validation:** `update({ accountType: "SUPERADMIN" })` must not change DB-authorized admin API results **or** JWT staff flags.
- **Launch-blocking:** Yes (public, closed beta).
- **Phase 15B status: RESOLVED.** The shared edge JWT callback no longer reads `update()` payloads at all; the node auth instance (`lib/auth/index.ts`) re-derives `kobaId`, `accountType`, and `kobaIdRevealed` from `getAccountSnapshot` (database) on every `update` trigger. Account switch and reveal flows still work because both persist to the database before calling `update()`. Tests: "KOBA-SEC-004 JWT claims cannot be set by the client". Residual: none identified for claim spoofing; JWT lifetime/rotation remains KOBA-SEC-008 (15C).

#### KOBA-SEC-005 — Login is not rate-limited

- **Category:** Brute force
- **Confidence:** High
- **Component:** `lib/auth/credentials-provider.ts` vs `app/api/auth/register|forgot-password|reset-password|verify-email`
- **Evidence:** Those four routes call `rateLimit`; credentials `authorize` does not.
- **Impact:** Online password guessing against staff and users, especially the published seed password.
- **Remediation:** Rate-limit `/api/auth/[...nextauth]` / authorize by IP+email; lockout; consider Upstash mandatory in staging+.
- **Validation:** 30 failed logins from one IP return 429.
- **Launch-blocking:** Yes (public, closed beta).
- **Phase 15B status: RESOLVED.** `features/auth/lib/login-throttle.ts` limits credentials `authorize` to 20 attempts / 15 min per IP and 10 / 15 min per target email, before any database read. Throttled attempts return the same generic failure as bad credentials (no enumeration). Tests: "KOBA-SEC-005 login throttling" (per-email, per-IP spray, unrelated-user isolation). Residual: limiter is per-process without Upstash (KOBA-SEC-009, staging condition unchanged).

#### KOBA-MED-001 — Malware scanning is a dead hook; archives are allowed

- **Category:** Insecure file upload
- **Confidence:** High
- **Component:** `features/aiden/lib/malware-scan.ts`, `DEV_MALWARE_SCAN_URL`, `features/developers/lib/artifacts.ts`
- **Evidence:** `malwareScanningActive()` **always returns false**. `scanGeneratedBytes` returns `{ scanned: false, clean: true }` even when a URL is set (“Scanner endpoint is not wired”). Allowed developer extensions include `zip`, `gz`, `tgz`, `tar`. No magic-byte inspection anywhere.
- **Malware scanning status:** **represented by a hook only** (not configured-but-inactive in a working sense — the hook cannot activate).
- **Impact:** A published developer artifact can contain executables inside an archive. Staff review is process-only.
- **Remediation:** Wire a scanner or disallow archives until then; inspect magic bytes; never treat MIME as truth.
- **Validation:** Uploading a zip with an `.exe` inside is rejected or quarantined.
- **Launch-blocking:** Yes (public developer marketplace). Closed beta if artifacts are in scope.
- **Phase 15B status: PARTIALLY MITIGATED — still launch-blocking for the public developer marketplace.** Added `artifactBytesMatchExtension` (magic-byte validation: zip/gzip/tar signatures required, native PE/ELF/Mach-O executables rejected outright, text artifacts must be NUL-free), enforced in `attachArtifact`; signed S3 downloads now force `Content-Disposition: attachment` + `application/octet-stream` so artifacts can never render inline. Quarantine + staff approval were already enforced. Tests: "KOBA-MED-001 artifact content validation". **No actual malware scanner is wired — this audit still does not claim scanning is active.** Executables _inside_ archives are not inspected. Close fully in a later phase by wiring a real scanner or disallowing archives.

#### KOBA-PWA-001 — Authenticated navigations are cached with NetworkFirst

- **Category:** Sensitive PWA caching
- **Confidence:** High
- **Component:** `app/sw.ts`, `lib/pwa/sensitive-routes.ts`
- **Evidence:** Sensitive **API** prefixes use `NetworkOnly`. **All navigations** use `NetworkFirst` (`koba-pages`, 5s timeout). `/admin`, `/wallet`, `/messages`, `/orders`, `/business` are not NetworkOnly as documents. `/api/` is in `NETWORK_FIRST_PATH_PREFIXES` but `isSensitivePath` wins first for listed APIs.
- **Impact:** Shared device or stolen profile can show a recently viewed wallet/admin HTML shell from Cache Storage after logout.
- **Remediation:** NetworkOnly (or no-store) for authenticated document routes; never cache `/admin`.
- **Validation:** After viewing `/wallet`, logout, airplane mode → must not show wallet HTML.
- **Launch-blocking:** Yes (public).
- **Phase 15B status: RESOLVED.** `SENSITIVE_DOCUMENT_PREFIXES` / `isSensitiveDocumentPath` in `lib/pwa/sensitive-routes.ts` route authenticated documents (`/admin`, `/wallet`, `/messages`, `/orders`, `/business`, `/settings`, `/dashboard`, `/influencer`, `/seller`, `/developers`, `/library`, `/trade`, `/kobaid`, `/enter`, `/aiden`, `/plus`, `/servers/connect|manage`) through `NetworkOnly` in `app/sw.ts` (offline fallback preserved). Page cache renamed to `koba-pages-v2`; the legacy `koba-pages` cache is deleted on activation. Public pages and the offline shell remain cacheable. Tests: "KOBA-PWA-001/002 sensitive document caching". Residual: none identified for document caching.

#### KOBA-PWA-002 — Logout does not clear service-worker caches

- **Category:** Sensitive PWA caching
- **Confidence:** High
- **Component:** `components/koba/app-header.tsx` `signOut({ callbackUrl: "/" })`
- **Evidence:** No `caches.delete` / SW message on logout. Dev-only unregistration exists in `pwa-provider.tsx`.
- **Impact:** Same as KOBA-PWA-001 after explicit logout.
- **Remediation:** Post a `CLEAR_CACHES` message to the SW on sign-out; expire `koba-pages`.
- **Validation:** Cache Storage empty of page entries after logout.
- **Launch-blocking:** Yes (public).
- **Phase 15B status: RESOLVED.** Sign-out now calls `clearPageCaches()` (`lib/pwa/clear-caches.ts`) which deletes `koba-pages-v2` and legacy page caches from the window and also messages the service worker (`CLEAR_PAGE_CACHES`) before `signOut` runs. With KOBA-PWA-001 fixed, sensitive documents are never cached in the first place, so account switching cannot reveal the previous account's pages either. Tests: cache-name versioning covered in "KOBA-PWA-001/002"; the clear itself is a browser API wrapper verified manually (see manual test checklist).

#### KOBA-OPS-001 — No production backup or restore drill

- **Category:** Disaster recovery
- **Confidence:** High
- **Component:** Repository docs / compose
- **Evidence:** Search for backup/restore/disaster recovery in product docs found only a DM vanish caveat. Compose volume `koba_pg_data` is local. No pg_dump schedule, off-site copy, or restore runbook.
- **Impact:** Disk loss or bad migration is unrecoverable. Spec treats this as a public-launch blocker.
- **Remediation:** Phase 15E — scheduled off-site backups, documented restore, quarterly drill.
- **Validation:** Restore a backup into a fresh instance and pass a ledger/order checksum.
- **Launch-blocking:** Yes (public, real-money). Staging if data must survive.

#### KOBA-OPS-003 — No error monitoring or financial alerting

- **Category:** Insufficient logging / incident response
- **Confidence:** High
- **Component:** Entire app
- **Evidence:** No `Sentry` / APM references. Logs are `console.error` / worker JSON to stdout. Health has no queue-depth or webhook-failure metrics. `SESSION_REVOKED` exists as an enum and is unused in app code.
- **Impact:** Stripe webhook 500s, ledger errors, and worker poison messages can go unseen. Spec: no incident visibility for financial failures is a launch blocker.
- **Remediation:** Phase 15D — Sentry (or equivalent) on web + workers; alert on webhook handler failures and job DLQ.
- **Validation:** Forced webhook signature failure pages an owner.
- **Launch-blocking:** Yes (public, real-money).

#### KOBA-LEG-001 — No customer-facing operational policies

- **Category:** Legal / policy
- **Confidence:** High
- **Component:** `app/` routes; `docs/`
- **Evidence:** No Terms, Privacy, Cookie, AUP, seller, developer, refund, digital-goods, community, copyright, AI, ads, or influencer **policy pages**. `roadmap/legal-tos-review.md` is game-publisher research, not KOBA terms, and states it is not legal counsel.
- **Impact:** Public/closed beta without required operational policies. Not legal advice — a lawyer must still draft/review.
- **Remediation:** Phase 15F — publish reviewed policies and link from register/checkout.
- **Validation:** Register and checkout surface ToS/privacy; refund policy matches Stripe refund code paths.
- **Launch-blocking:** Yes (public, closed beta).

#### KOBA-SEC-012 — No account deletion or privacy-request workflow

- **Category:** Privacy
- **Confidence:** High
- **Component:** User model / settings
- **Evidence:** No `deleteAccount`, GDPR, or privacy-request code. `User` has no suspension flag. Cascade deletes exist on many relations; Orders use `onDelete: Restrict` — deletion would fail or require a defined anonymization path that does not exist.
- **Impact:** Cannot honour deletion requests; cannot globally suspend a user (only shops/servers/dev profiles/influencers have suspend fields).
- **Remediation:** Define retention, anonymize vs restrict, staff suspend-user, documented privacy inbox.
- **Validation:** End-to-end deletion request against staging data.
- **Launch-blocking:** Yes (public). Closed beta if EU/UK users are in scope.

#### KOBA-DEP-001 — Next.js still nests vulnerable `sharp@0.34.5`

- **Category:** Vulnerable dependencies
- **Confidence:** High (advisory); medium (exploitability in this app)
- **Component:** `pnpm-lock.yaml` via `next@15.5.23`
- **Evidence:** `pnpm audit` HIGH GHSA-f88m-g3jw-g9cj (libvips heap overflow on untrusted images). Direct `sharp` is `^0.35.3` (devDependency) but **Next still depends on `sharp@0.34.5`**. Allowed uploads include `image/gif`. CVSS 7.0, AV:L, PR:L — not a remote unauthenticated RCE proof, but Next image optimization can process user images.
- **Impact:** Crafted GIF/TIFF may crash or corrupt the image worker. Not demonstrated here.
- **Remediation:** pnpm override `sharp>=0.35.0` and/or upgrade Next when it vendors a patched sharp; consider blocking GIF until then.
- **Validation:** `pnpm why sharp` shows no `<0.35.0`; re-run `pnpm audit`.
- **Launch-blocking:** Yes (public), because untrusted image upload + nested vulnerable sharp matches the “critical/high dependency with a processing path” rule. Not treated as CRITICAL (no proven RCE in KOBA).
- **Phase 15B status: RESOLVED.** pnpm overrides added: `sharp>=0.35.3` and `postcss>=8.5.23` (the latter closes KOBA-DEP-002 in the same lockfile pass). `pnpm install` updated the lockfile; `pnpm audit` now reports **"No known vulnerabilities found"** (was 3 high + 2 moderate). Verified with full `pnpm test` and a production `pnpm build`. Risk note: Next 15.5.23 pins `sharp@0.34.5` / `postcss@8.4.31` internally; both overrides stay within the same major versions and the build/test suite passed, but image-optimization behaviour should be spot-checked in staging.

#### KOBA-FIN-002 — Duplicate of observability for money (see KOBA-OPS-003)

Listed once in blockers as financial-incident blindness. Same evidence.

#### KOBA-GIT-001 — Product is 83 commits ahead of `origin/main`

- **Category:** Release integrity
- **Confidence:** High
- **Component:** Git
- **Evidence:** `git log origin/main..HEAD` = 83 commits. Remote feature branches are only foundation/trading/coins/marketplace/owner-ui. 14B–14I are **local-only**. CI does not run on `docs/**` pushes. No git tags.
- **Impact:** Launching or tagging `main` as it exists on origin ships an older product and misses money/ledger/RCON/Plus/Aiden/developers/promotions.
- **Remediation:** Integrate the stack through reviewed PRs; protect `main`; tag releases.
- **Validation:** `origin/main` contains 14I when you intend to launch.
- **Launch-blocking:** Yes (any production cut from `origin/main` today).

### 5.2 MEDIUM

#### KOBA-SEC-006 — No production security headers or CSP

- **Evidence:** `next.config.ts` only sets `poweredByHeader: false`. No CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` / `frame-ancestors`, COOP/COEP.
- **Impact:** XSS and clickjacking have no browser belt-and-suspenders. Serwist + a future CSP need coordinated nonces.
- **Launch-blocking:** No (fix in 15B). Closed beta should still add HSTS at the proxy.
- **Phase 15B status: RESOLVED (with a documented CSP exception).** `next.config.ts` now sends on every route: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geo/payment/usb denied), and HSTS outside development. CSP: `default-src 'self'`; `frame-src 'none'`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `img/media-src https:` (media URLs are https-validated at write time); **`unsafe-eval` and websockets are development-only**. Documented exception: `script-src`/`style-src` keep `'unsafe-inline'` because Next App Router injects inline bootstrap scripts and Tailwind emits inline styles — a nonce-based CSP is explicitly deferred and this audit does **not** claim inline-script hardening. Verified via production build.

#### KOBA-SEC-007 — `trustHost: true`

- **Evidence:** `lib/auth/index.ts` and middleware Auth.js config.
- **Impact:** Host-header confusion can affect Auth.js URL generation if the proxy does not overwrite `Host`/`X-Forwarded-Host`.
- **Launch-blocking:** No; must be correct at the reverse proxy in 15E.

#### KOBA-SEC-008 — 30-day JWT, no rotation/revocation path

- **Evidence:** `session.maxAge` 30 days. `SESSION_REVOKED` unused. Password reset does not demonstrate token version bump in this audit.
- **Impact:** Stolen cookie works for up to 30 days.
- **Launch-blocking:** No for internal; yes as a **condition** of closed beta (pair with 15C).

#### KOBA-SEC-009 — Rate limits are per-process without Upstash

- **Evidence:** `lib/security/rate-limit.ts` memory `Map`; Upstash failures fall back to memory.
- **Impact:** Two Node processes double the limit; attackers bypass by spraying instances.
- **Launch-blocking:** Staging condition (require Upstash).

#### KOBA-SEC-010 — `AUTH_SECRET` fail-closed is inconsistent

- **Evidence:** `getServerEnv()` requires length ≥ 32. `resolveAuthSecret()` returns `""` in production if unset, and a **hardcoded 32+ char development fallback** otherwise.
- **Impact:** Auth.js init may not use the same gate as `getServerEnv()`. Local `.env` in this workspace listed only `DATABASE_URL` (value redacted); Auth likely used the development fallback. Not a committed production secret.
- **Launch-blocking:** No; must fail boot in production without a strong secret (15B/15E).
- **Phase 15B status: RESOLVED.** `resolveAuthSecret()` now **throws at production runtime** when `AUTH_SECRET` is unset (fail closed); a placeholder is used only during `next build` (`NEXT_PHASE=phase-production-build`, where no real sessions are signed); the development fallback remains dev/test-only. Tests: "KOBA-SEC-010 auth secret resolution". Manual action: production/staging operators must set a ≥32-char `AUTH_SECRET` before `next start` will boot.

#### KOBA-SEC-011 — No platform-wide user suspension

- **Evidence:** `User` model has email/password only. Suspend exists on servers, developer profiles, influencer profiles — not login.
- **Impact:** A banned user can still authenticate and hit unguarded surfaces.
- **Launch-blocking:** Closed-beta condition.

#### KOBA-SEC-013 — Empty media host allowlist accepts any `https` URL

- **Evidence:** `isAllowedMediaUrl` returns true for any https when `MEDIA_ALLOWED_HOSTS` / `S3_PUBLIC_BASE_URL` unset.
- **Impact:** Stored XSS/SSRF-adjacent content if HTML ever rendered URLs unsafely; tracking pixels in posts.
- **Launch-blocking:** No if markdown/HTML stays text-only (no `dangerouslySetInnerHTML` found).

#### KOBA-SEC-014 — No magic-byte or dimension checks on social media

- **Evidence:** Presign trusts `contentType` enum; 5-minute PUT; sanitized filename; no file-type library.
- **Launch-blocking:** No; pair with KOBA-MED-001 for artifacts.

#### KOBA-FIN-003 — Auction settlement depends on a web read

- **Evidence:** `settleExpiredAuctions` is only called from `getPublicAuction`. No `auctions:settle` worker script.
- **Impact:** An auction with no viewers stays `LIVE` after `endsAt`. Anti-snipe itself is implemented (`extendedEndsAt`).
- **Launch-blocking:** Real-money auctions: yes. Test marketplace: condition.

#### KOBA-FIN-004 — Ledger concurrency not proven in this audit

- **Evidence:** Integration tests skip unless `KOBA_LEDGER_INTEGRATION=1`. This run: **18 skipped**, 301 passed. Code uses BigInt, `FOR UPDATE`, unique `idempotencyKey`, negative-projection guards.
- **Launch-blocking:** Real-money coins: condition (run integration against staging DB).

#### KOBA-OPS-002 — No deploy artifact, proxy, or process manager in repo

- **Evidence:** No Dockerfile; compose is Postgres only; no nginx/Caddy/systemd/healthcheck for the Node process; no graceful `server.close` documented for Next.
- **Launch-blocking:** Staging **condition** (external runbook required).

#### KOBA-OPS-004 — Public `/api/health?deep=1` queries the database

- **Evidence:** Unauthenticated deep ping. Useful for probes; also a cheap DB load vector.
- **Launch-blocking:** No; restrict deep checks at the proxy.

#### KOBA-OPS-005 — Workers default to one-shot; loops off

- **Evidence:** `AIDEN_WORKER_LOOP=false` (and peers) in `.env.example`. Scripts exist with SIGINT handling for loops.
- **Impact:** Forgetting cron means Aiden jobs, webhooks, promotions, server status never advance. **Jobs that depend on HTTP:** auction settle; possibly others if operators rely on admin “reconcile” buttons (`/api/admin/plus/reconcile`).
- **Launch-blocking:** Staging condition.

#### KOBA-OPS-006 — Compose publishes Postgres on 5432 with a known password

- **Evidence:** `docker-compose.yml`. Intended for local. VPS exposure **NOT VERIFIED**.
- **Launch-blocking:** Public if the owner’s VPS mirrors compose ports (externally required to confirm it does not).

#### KOBA-OPS-007 — `pg.Pool` has no max size or statement timeout

- **Evidence:** `lib/db.ts` `new Pool({ connectionString })`. Fallback URL `postgresql://koba:koba@localhost:5432/koba` if `DATABASE_URL` missing (non-`getServerEnv` path).
- **Launch-blocking:** No; set pool and timeouts before multi-worker VPS.

#### KOBA-OPS-008 — CI pin and trigger gaps

- **Evidence:** `actions/checkout@v4`, `pnpm/action-setup@v4`, `setup-node@v4` (moving tags). Push CI: `main`, `chore/**`, `feat/**`, `fix/**` — **not** `docs/**`. No e2e job. `AUTH_SECRET` in CI is a dummy build secret (not a production leak).
- **Launch-blocking:** No.

#### KOBA-OPS-009 — `pnpm format:check` fails (pre-existing CRLF)

- **Evidence:** 151 files; same class of failure noted after Phase 14I. Predates this audit. `pnpm ci` would fail. This branch would not run that workflow on push.
- **Launch-blocking:** No for security; **yes for merging to `main` via current CI** until format is normalized.

#### KOBA-DEP-002 — Nested `postcss@8.4.31` advisories

- **Evidence:** `pnpm audit` HIGH/moderate sourceMappingURL issues via Next. Typical impact is **build-time** CSS tooling, not KOBA request handlers. Confidence medium that this is not runtime-exploitable here.
- **Launch-blocking:** No.
- **Phase 15B status: RESOLVED.** Covered by the same lockfile pass as KOBA-DEP-001 (`postcss>=8.5.23` override). `pnpm audit` is clean.

#### KOBA-OPS-010 — No HTTP request / correlation IDs

- **Evidence:** Correlation IDs exist for RCON integration ops, not for general HTTP.
- **Launch-blocking:** No (15D).

#### KOBA-OPS-011 — Audit log is not tamper-evident

- **Evidence:** Append-only in practice, no hash chain, actor can be `SetNull` on user delete.
- **Launch-blocking:** No.

#### KOBA-E2E-001 — Playwright is not a release gate

- **Evidence:** `pnpm test:e2e` failed (2/2). `reuseExistingServer` talked to a **non-KOBA** process already bound to `127.0.0.1:3000`. `home.spec.ts` still expects Phase 1 copy. CI does not run e2e. This is **not** evidence that KOBA pages crashed.
- **Launch-blocking:** No.

#### KOBA-A11Y-001 — WCAG and Lighthouse not verified

- **Evidence:** Login fields use `FormField` labels; Plus page heading is keyboard-targetable in code. No axe/Lighthouse run (port 3000 was not KOBA). **Do not claim WCAG compliance.**
- **Launch-blocking:** No (15G). Public should still fix obvious a11y before launch.

#### KOBA-GIT-003 — No release tags, rollback, or verified branch protection

- **Evidence:** `git tag` empty. GitHub branch protection **NOT VERIFIED** (no live GitHub settings inspection in this phase).
- **Launch-blocking:** Public condition.

### 5.3 LOW

#### KOBA-OPS-012 — README still describes stacked feature branches as current homes

- **Evidence:** README says 14I “in progress” on `feat/influencer-promotions` while 14I is committed. Confusing for operators.
- **Launch-blocking:** No.

#### KOBA-SEC-016 — Health endpoint is public by design

- **Evidence:** Not on the sensitive-path denylist. OK if deep checks are proxied.
- **Launch-blocking:** No.

### 5.4 INFORMATIONAL (controls that are working)

| ID           | Note                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| KOBA-FIN-001 | Live Stripe blocked; `STRIPE_ALLOW_LIVE=true` does **not** enable `sk_live_`. Real-money remains a future 15H review, not a hidden switch.       |
| KOBA-SEC-017 | Production email fail-closed without Resend.                                                                                                     |
| KOBA-SEC-018 | SSRF helpers on server poll, RCON, Aiden provider fetch, developer webhooks. Residual bypass **NOT VERIFIED** by hostile testing (out of scope). |
| KOBA-SEC-019 | Stripe webhooks: `constructEvent` + `ProcessedStripeEvent` insert claim.                                                                         |
| KOBA-SEC-020 | RCON secrets AES-256-GCM; missing key fails closed.                                                                                              |
| KOBA-GIT-002 | Historical `Co-Authored-By: Claude Sonnet 5` trailers exist. **Do not rewrite history.** New commits must not add agent attribution.             |
| KOBA-LIC-001 | All Rights Reserved license unaltered.                                                                                                           |
| KOBA-FIN-005 | Coin cash purchase/withdrawal deferred — do not advertise as live.                                                                               |

---

## 6. Launch blockers

Treat these as **blocking public production** (and where noted, closed beta / real money). Status column reflects **Phase 15B** (2026-08-15):

1. **KOBA-SEC-001** Seed SUPERADMIN password — **RESOLVED in 15B**
2. **KOBA-SEC-002** Open redirect — **RESOLVED in 15B**
3. **KOBA-SEC-003** Staff MFA missing — open (15C)
4. **KOBA-SEC-004** Client-writable JWT `accountType` — **RESOLVED in 15B**
5. **KOBA-SEC-005** Unrate-limited login — **RESOLVED in 15B**
6. **KOBA-MED-001** Archive uploads without an active malware scanner — **partially mitigated in 15B; still blocking** (no real scanner)
7. **KOBA-PWA-001 / KOBA-PWA-002** Private page cache + no logout purge — **RESOLVED in 15B**
8. **KOBA-OPS-001** No backups / restore drill — open (15E)
9. **KOBA-OPS-003 / KOBA-FIN-002** No financial incident visibility — open (15D)
10. **KOBA-LEG-001** Missing operational policies — open (15F)
11. **KOBA-SEC-012** No account deletion / user suspend — open (15F)
12. **KOBA-DEP-001** Nested vulnerable `sharp` on an untrusted-image path — **RESOLVED in 15B** (`pnpm audit` clean)
13. **KOBA-GIT-001** Cannot launch from current `origin/main` — open (process; requires pushing/merging the stack)
14. **KOBA-FIN-003** (real-money auctions) Request-driven settlement — open (15H)

Not proven, therefore **not** listed as blockers: ledger invariant _failure_, unrestricted SSRF, exposed production Postgres/Redis, committed live credentials.

---

## 7. Staging-readiness decision

**Status: READY WITH CONDITIONS**

A staging VPS _can_ run this commit for internal QA with:

- Stripe **test** keys only
- `NODE_ENV=production`, strong `AUTH_SECRET`, Resend, Upstash, S3 allowlist, credential encryption key
- **Never** `db:seed` on that database
- Migrations applied forward (`prisma migrate deploy`) — **not verified** against a clone of prod because prod does not exist
- Cron for workers
- An operator-supplied reverse proxy, TLS, and firewall (not in repo)

Staging is **not** “configured in repository.” Classify deploy pieces as **externally required**. Do not call staging production-like until backups and Sentry exist.

---

## 8. Closed-beta decision

**Status: NOT READY** (unchanged after 15B)

Blockers remaining after 15B: staff MFA, legal pages, backups, no user suspend/deletion, observability. Resolved in 15B: seed password, open redirect, login brute force, JWT claim spoof. Invite-only users still deserve the remaining controls if they can pay, message, or upload.

---

## 9. Public-launch decision

**Status: NOT READY** (unchanged after 15B)

Remaining: all open closed-beta blockers, the inactive malware scanner (KOBA-MED-001 residual), and the integration-branch gap vs `origin/main`. Resolved in 15B: PWA cache/logout purge and the `sharp`/`postcss` advisories.

---

## 10. Real-money-launch decision

**Status: NOT READY**

Reasons:

- Live Stripe is **intentionally impossible** today (`isStripeConfigured` / `getStripeReadiness` `live-blocked`).
- No 15H live-mode runbook, Connect capability review, or chargeback playbook in repo.
- No alerting on webhook failures.
- Ledger integration tests were **skipped** in this environment.
- Auction settlement is not a worker.
- Refunds and commissions have unit tests; they are not a live Stripe reconciliation.

Integer/BigInt money, order line snapshots (`titleSnapshot`, `unitPriceCents`), webhook-authoritative paid status, and idempotency keys are **positive design evidence** — necessary, not sufficient.

---

## 11. Infrastructure requirements

| Requirement                                | Classification                                             |
| ------------------------------------------ | ---------------------------------------------------------- |
| Linux distro                               | Externally required / not specified                        |
| Docker app image                           | Missing                                                    |
| Compose Postgres                           | Configured in repository (local)                           |
| Reverse proxy + HTTPS + auto-renew         | Externally required                                        |
| Firewall / SSH hardening / non-root user   | Externally required / not verified                         |
| Postgres not public                        | Externally required; compose **does** publish 5432 locally |
| Redis                                      | Optional Upstash; not a local Redis container              |
| Secret storage                             | `.env` gitignored; no vault docs                           |
| Log rotation / disk / CPU limits           | Missing                                                    |
| Worker supervision                         | Documented as VPS cron; not configured                     |
| Health                                     | Configured (`/api/health`)                                 |
| Readiness (deps + migrations + workers)    | Missing as a distinct probe                                |
| Graceful shutdown (Next)                   | Not verified                                               |
| Restart policy                             | Compose `unless-stopped` for Postgres only                 |
| Deploy rollback                            | Missing (no tags)                                          |
| Migration ordering                         | 20 timestamped Prisma migrations in repo                   |
| Zero-downtime deploy                       | Missing                                                    |
| Backup schedule / off-site / restore drill | Missing                                                    |
| Staging environment                        | Missing                                                    |
| Domain / DNS / email DNS                   | Externally required                                        |
| DDoS / CDN                                 | Missing / not verified                                     |
| Owner VPS security                         | **NOT VERIFIED** — do not assume                           |

---

## 12. Legal and policy gaps

| Document                    | In repository?                                | Lawyer review before launch?                   |
| --------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Terms of Service            | No                                            | Yes                                            |
| Privacy Policy              | No                                            | Yes                                            |
| Cookie Policy               | No                                            | Yes                                            |
| Acceptable Use              | No                                            | Yes                                            |
| Marketplace Seller Terms    | No                                            | Yes                                            |
| Developer Terms             | No                                            | Yes                                            |
| Refund Policy               | No                                            | Yes (must match Stripe/staff refund behaviour) |
| Digital Goods Policy        | No                                            | Yes                                            |
| Community Guidelines        | No                                            | Yes                                            |
| Copyright / takedown        | No                                            | Yes                                            |
| AI-generated content policy | No (Aiden docs are product, not legal)        | Yes                                            |
| Advertising disclosure      | Product UI mentions disclosure; no legal page | Yes                                            |
| Influencer disclosure       | Same                                          | Yes                                            |
| Prohibited products         | No                                            | Yes                                            |
| Age requirement             | No                                            | Yes                                            |
| Account deletion process    | No                                            | Yes                                            |
| Privacy request process     | No                                            | Yes                                            |
| Security contact            | No                                            | Yes                                            |
| Business identity / contact | No                                            | Yes                                            |

`roadmap/legal-tos-review.md` is **publisher ToS research**, not KOBA policies. This audit is not legal advice and does not claim compliance.

---

## 13. Test and command evidence

Commands run during Phase 15A on Windows / pnpm. Failures are not concealed.

| Command                | Result                | Detail                                                                                                                                                  | Predates this audit?                                    | Launch impact                                             |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `pnpm format:check`    | **Fail**              | Prettier: **151 files** (CRLF / style).                                                                                                                 | Yes (also failed after 14I).                            | `pnpm ci` / GitHub `feat/**` CI will fail until fixed.    |
| `pnpm lint`            | **Pass**              | `eslint . --max-warnings 0` exit 0.                                                                                                                     | N/A                                                     | None.                                                     |
| `pnpm typecheck`       | **Pass**              | `tsc --noEmit` exit 0.                                                                                                                                  | N/A                                                     | None.                                                     |
| `pnpm test`            | **Pass**              | Vitest 4.1.10: **301 passed**, **18 skipped**, 45 files passed, 4 skipped, ~260s. Skips include ledger/trading/server integration unless env flags set. | Skips are by design.                                    | Do not treat skip as concurrency proof.                   |
| `pnpm build`           | **Pass**              | Next.js 15.5.23 production build exit 0; Serwist bundled `/sw.js`; First Load JS shared ~104 kB.                                                        | N/A                                                     | Bundle size recorded; no Lighthouse.                      |
| `pnpm audit`           | **Fail** (advisories) | **5** issues: **3 high**, **2 moderate**. Nested `sharp@0.34.5` (GHSA-f88m-g3jw-g9cj) and nested `postcss@8.4.31` via Next 15.5.23.                     | Unknown when first introduced; present now.             | See KOBA-DEP-001/002. **No upgrades performed.**          |
| `pnpm prisma validate` | **Pass**              | Schema valid.                                                                                                                                           | N/A                                                     | None.                                                     |
| `pnpm prisma generate` | **Pass**              | Client 7.9.1 → `lib/generated/prisma`.                                                                                                                  | N/A                                                     | Generated client is gitignored.                           |
| `pnpm test:e2e`        | **Fail**              | 2 failed. Playwright reused a **non-KOBA** listener on port 3000 (`reuseExistingServer: !CI`). Specs also still mention Phase 1.                        | Spec staleness yes; port conflict is local environment. | E2E is **not** in CI. Do not treat as KOBA UI regression. |
| Lighthouse             | **NOT VERIFIED**      | Not run (no trustworthy KOBA origin on :3000).                                                                                                          | N/A                                                     | Performance scores not invented.                          |

Local `.env` (gitignored): only `DATABASE_URL` was present. Category: **database connection string**. It is **not** committed. A pre-existing `npm run dev` log on this machine showed Postgres auth failure against Prisma-style default credentials (`johndoe`) — local misconfiguration, not a repo secret leak. `.env.example` values are placeholders (`replace_me`, `sk_test_replace_me`). No `.pem` tracked. `lib/generated/prisma` and `public/sw.js` are gitignored. `.next` build output is untracked.

---

## 14. Remediation roadmap

Order follows the Phase 15 brief unless evidence forced a change. **No change to ordering:** 15B still comes first because demonstrated authz/session/redirect/seed issues are cheaper and more urgent than MFA enrolment UX, and MFA on a spoofable JWT would be theatre.

| Phase   | Focus                                                 | Addresses                                                                                  |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **15B** | Critical security and authorization hardening         | SEC-002, SEC-004, SEC-001, SEC-005, SEC-006, SEC-010, login lockout, production seed guard |
| **15C** | Staff MFA, sessions, administrative security          | SEC-003, SEC-008, SEC-011, step-up for refunds/RCON/keys                                   |
| **15D** | Observability, Sentry, incident response              | OPS-003, OPS-010, webhook/job alerts, security contact process                             |
| **15E** | VPS deployment, backups, DR                           | OPS-001, OPS-002, OPS-005–007, proxy headers vs `trustHost`, Postgres exposure             |
| **15F** | Legal pages, privacy, marketplace policies            | LEG-001, SEC-012                                                                           |
| **15G** | Performance, accessibility, Lighthouse                | A11Y-001, format CRLF, e2e against KOBA, PWA cache (if not pulled into 15B)                |
| **15H** | Stripe live-mode launch review and controlled release | FIN-001/003/004, DEP-001 override, Connect/chargebacks, real-money checklist               |

PWA cache (PWA-001/002) and malware hook (MED-001) may be pulled **into 15B** if public beta is attempted before 15G; they are already launch blockers.

---

## 15. Recommended phase ordering

1. Merge/integrate stacked phases onto a protected integration branch (process, parallel to 15B).
2. **Phase 15B** immediately.
3. 15C → 15D → 15E → 15F → 15G.
4. **Phase 15H last.** Do not set `STRIPE_ALLOW_LIVE` folklore: live mode needs an explicit product change, not an env flag that currently does nothing.

---

## 16. Phase 15B remediation (2026-08-15)

Branch: `fix/critical-security-hardening` (created from `docs/production-readiness-audit` after the 15A audit commit). Scope: evidence-backed HIGH launch blockers plus the two MEDIUM findings the 15A roadmap explicitly assigned to 15B (SEC-006, SEC-010) and DEP-002, which shares DEP-001's lockfile fix. No Prisma schema or migration changes were required by the selected findings.

### 16.1 Traceability

| Finding ID   | Original severity | Affected component                                                           | Fix implemented                                                                                                       | Tests added                                   | Remaining risk                                                                      | Status                  |
| ------------ | ----------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| KOBA-SEC-001 | HIGH              | `prisma/seed.ts`, README                                                     | Production seed guard (`lib/security/seed-guard.ts`); no known/reset password; random one-time password on first seed | `security-hardening.test.ts` — seed guard     | Previously seeded local DBs keep old password                                       | Resolved                |
| KOBA-SEC-002 | HIGH              | `features/auth/components/login-form.tsx`                                    | `safeInternalPath` allowlist (`lib/security/safe-redirect.ts`) applied to `callbackUrl`                               | safe redirect suite                           | None identified                                                                     | Resolved                |
| KOBA-SEC-004 | HIGH              | `lib/auth/edge.config.ts`, `lib/auth/index.ts`                               | Edge JWT callback ignores `update()` payloads; node callback re-derives claims from DB snapshot                       | JWT claim suite                               | Token lifetime (SEC-008, 15C)                                                       | Resolved                |
| KOBA-SEC-005 | HIGH              | `lib/auth/credentials-provider.ts`                                           | Per-IP (20/15 min) + per-email (10/15 min) throttle before DB access, non-enumerating                                 | login throttling suite                        | Per-process limiter without Upstash (SEC-009)                                       | Resolved                |
| KOBA-MED-001 | HIGH              | `features/developers/lib/artifacts.ts`, `storage.ts`, `developer.service.ts` | Magic-byte validation; native executables rejected; signed downloads forced to `attachment` + octet-stream            | artifact content suite                        | **No real scanner; archive contents not inspected — still launch-blocking**         | Partially mitigated     |
| KOBA-PWA-001 | HIGH              | `app/sw.ts`, `lib/pwa/sensitive-routes.ts`                                   | Sensitive documents `NetworkOnly`; versioned `koba-pages-v2` cache; legacy cache deleted on activate                  | sensitive document caching suite              | None identified                                                                     | Resolved                |
| KOBA-PWA-002 | HIGH              | `components/koba/app-header.tsx`, `lib/pwa/clear-caches.ts`                  | Logout clears page caches from window and SW (`CLEAR_PAGE_CACHES`)                                                    | cache versioning assertions; manual checklist | Browser-API path verified manually                                                  | Resolved                |
| KOBA-DEP-001 | HIGH              | `package.json`, `pnpm-lock.yaml`                                             | pnpm override `sharp>=0.35.3`; lockfile updated                                                                       | `pnpm audit` clean; full test + build         | Next pins 0.34.5 internally — spot-check image optimization in staging              | Resolved                |
| KOBA-DEP-002 | MEDIUM            | `pnpm-lock.yaml`                                                             | pnpm override `postcss>=8.5.23` (same pass)                                                                           | `pnpm audit` clean                            | Same as above                                                                       | Resolved                |
| KOBA-SEC-006 | MEDIUM            | `next.config.ts`                                                             | CSP, HSTS (prod), nosniff, referrer, permissions, frame denial; dev/prod aware                                        | Verified via production build                 | `unsafe-inline` script/style kept (Next App Router); nonce CSP deferred, documented | Resolved with exception |
| KOBA-SEC-010 | MEDIUM            | `lib/auth/secret.ts`                                                         | Production runtime throws without `AUTH_SECRET`; build-phase placeholder; dev fallback unchanged                      | auth secret suite                             | Operators must set the secret before boot (manual action)                           | Resolved                |

### 16.2 Explicitly out of 15B scope (still open)

KOBA-SEC-003 (staff MFA → 15C), KOBA-OPS-001 (backups → 15E), KOBA-OPS-003/FIN-002 (observability → 15D), KOBA-LEG-001 (legal → 15F), KOBA-SEC-012 (deletion/suspend → 15F), KOBA-GIT-001 (integration process), KOBA-FIN-003 (auction settle worker → 15H). None of these had an immediate critical dependency on the 15B fixes.

### 16.3 Manual actions required from the owner

1. Rotate the `staff@koba.local` password in any database seeded before this fix (local/staging).
2. Set a strong (≥32 chars) `AUTH_SECRET` everywhere `NODE_ENV=production` runs — the app now refuses to boot without it.
3. Reinstall dependencies (`pnpm install`) on other machines to pick up the `sharp`/`postcss` overrides.
4. No production secrets were found, printed, or rotated by this phase.

### 16.4 Phase 15B command evidence

| Command                                                   | Result         | Detail                                                            |
| --------------------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `pnpm audit`                                              | **Pass**       | "No known vulnerabilities found" (was 3 high + 2 moderate in 15A) |
| `pnpm typecheck`                                          | **Pass**       | `tsc --noEmit` exit 0                                             |
| `pnpm test`                                               | **Pass**       | Full suite including 20 new security regression tests             |
| `pnpm build`                                              | See §13 update | Production build with headers/CSP and Serwist                     |
| `pnpm lint` / `pnpm format:check` / `pnpm prisma validate | generate`      | See §13 update                                                    | Run at end of phase |

---

## Appendix A — Part 1 Git integrity

| Check                                                    | Result                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current branch                                           | `docs/production-readiness-audit`                                                                                                                                  |
| Worked on `main`?                                        | No                                                                                                                                                                 |
| Uncommitted product changes at start                     | None                                                                                                                                                               |
| Accidentally committed `.env`                            | No (only `.env.example`)                                                                                                                                           |
| Accidentally committed `.next` / Prisma client / `sw.js` | No (gitignored)                                                                                                                                                    |
| Lockfile                                                 | `pnpm-lock.yaml` present (~253 KB); CI uses `--frozen-lockfile`                                                                                                    |
| Large binaries                                           | PWA/brand PNGs only                                                                                                                                                |
| License                                                  | ARR unaltered                                                                                                                                                      |
| Co-author trailers                                       | Present on older commits (Claude); not rewritten                                                                                                                   |
| Release tags                                             | None                                                                                                                                                               |
| Rollback strategy                                        | None documented                                                                                                                                                    |
| CI coverage                                              | Quality job; no e2e; `docs/**` push does not trigger                                                                                                               |
| Branch protection                                        | NOT VERIFIED                                                                                                                                                       |
| Phases implemented locally missing from `origin/main`    | 14B coins, 14C trading, 14D servers, 14E RCON, 14F Plus, 14G Aiden, 14H developers, 14I promotions, plus earlier shops/payments/social stack relative to `86f6b77` |

## Appendix B — Authentication and authorization notes

- Registration: Zod + IP rate limit 5 / 15 min.
- Email verification required before `authorize` succeeds.
- Password reset: rate-limited; production requires email.
- Logout: `signOut`; JWT not server-revoked.
- Account switching: `/api/accounts/switch` then client `update()`.
- KOBAID staff: issued, not self-minted (`canIssueStaffRole`).
- Admin UI: login redirect + `getAccountSnapshot` staff filter.
- Admin APIs sampled (`getAdminOverview`): `requireAnyStaff` from DB.
- Object-level auth: not exhaustively proven for every IDOR; shops/payments have dedicated tests. Residual IDOR **NOT VERIFIED** across all 14H/14I routes.
- CSRF: NextAuth cookies; no extra CSRF on JSON APIs — SameSite **NOT VERIFIED** in production.
- Open redirects: KOBA-SEC-002.
- Brute force: KOBA-SEC-005.
- Seed credentials must **never** be used against a live system (this audit did not).

## Appendix C — Data / financial notes

- Unique constraints include emails, KOBAID `(userId, accountType)`, ledger `idempotencyKey`, `ProcessedStripeEvent.eventId`, promo participation uniqueness.
- FKs mixed Cascade/Restrict; orders restrict buyer delete.
- Nested Prisma `$transaction` is a known project constraint (ledger uses interactive transactions).
- Money: integer cents / BigInt coins / basis points — no float in the reviewed payment/ledger paths.
- Checkout snapshots line items; paid via webhook `payment_status === "paid"`.
- Chargeback-specific handling **NOT VERIFIED** beyond `charge.refunded`.
- Promo/ad fraud thresholds exist as env caps (click burst, promo guess limit).

## Appendix D — Background jobs

| Job                | Entry                       | Claim / retry                                      | HTTP-dependent?            |
| ------------------ | --------------------------- | -------------------------------------------------- | -------------------------- |
| Server poll        | `pnpm servers:poll`         | Batch in polling service                           | No                         |
| Rust integrations  | `pnpm servers:integrations` | Worker service                                     | No                         |
| Plus reconcile     | `pnpm plus:reconcile`       | Script + admin button                              | Admin can trigger          |
| Aiden              | `pnpm aiden:worker`         | `version` optimistic claim; `maxAttempts` → FAILED | No (stalls without worker) |
| Developer webhooks | `pnpm developers:webhooks`  | `attempts` / `maxAttempts` → FAILED                | No                         |
| Influencer payouts | `pnpm influencer:payouts`   | Stripe test transfers                              | No                         |
| Promotions         | `pnpm promotions:worker`    | Commission qualification                           | No                         |
| Auction settle     | none                        | On `getPublicAuction`                              | **Yes**                    |

## Appendix E — Accessibility / performance (limited)

Representative flows were **code-reviewed**, not WCAG-certified. Login uses labelled inputs and error alerts. Plus heading exists in source. Mobile nav component exists. `prefers-reduced-motion` **NOT VERIFIED**. Touch targets **NOT VERIFIED**. Lighthouse **NOT VERIFIED**. First Load JS ~104 kB shared (Next build output). Horizontal scale: JWT is stateless; in-memory rate limit and SSE are single-instance constraints. Single-VPS failure takes app, workers, and (if colocated) Postgres.

## Appendix F — Finding index

| ID            | Severity | Launch-blocking     |
| ------------- | -------- | ------------------- |
| KOBA-SEC-001  | HIGH     | Yes                 |
| KOBA-SEC-002  | HIGH     | Yes                 |
| KOBA-SEC-003  | HIGH     | Yes                 |
| KOBA-SEC-004  | HIGH     | Yes                 |
| KOBA-SEC-005  | HIGH     | Yes                 |
| KOBA-MED-001  | HIGH     | Yes                 |
| KOBA-PWA-001  | HIGH     | Yes                 |
| KOBA-PWA-002  | HIGH     | Yes                 |
| KOBA-OPS-001  | HIGH     | Yes                 |
| KOBA-OPS-003  | HIGH     | Yes                 |
| KOBA-LEG-001  | HIGH     | Yes                 |
| KOBA-SEC-012  | HIGH     | Yes                 |
| KOBA-DEP-001  | HIGH     | Yes                 |
| KOBA-GIT-001  | HIGH     | Yes                 |
| KOBA-SEC-006  | MEDIUM   | No                  |
| KOBA-SEC-007  | MEDIUM   | No                  |
| KOBA-SEC-008  | MEDIUM   | Condition           |
| KOBA-SEC-009  | MEDIUM   | Staging condition   |
| KOBA-SEC-010  | MEDIUM   | No                  |
| KOBA-SEC-011  | MEDIUM   | Condition           |
| KOBA-SEC-013  | MEDIUM   | No                  |
| KOBA-SEC-014  | MEDIUM   | No                  |
| KOBA-FIN-003  | MEDIUM   | Real-money auctions |
| KOBA-FIN-004  | MEDIUM   | Real-money coins    |
| KOBA-OPS-002  | MEDIUM   | Staging condition   |
| KOBA-OPS-004  | MEDIUM   | No                  |
| KOBA-OPS-005  | MEDIUM   | Staging condition   |
| KOBA-OPS-006  | MEDIUM   | If VPS exposes 5432 |
| KOBA-OPS-007  | MEDIUM   | No                  |
| KOBA-OPS-008  | MEDIUM   | No                  |
| KOBA-OPS-009  | MEDIUM   | CI merge            |
| KOBA-DEP-002  | MEDIUM   | No                  |
| KOBA-OPS-010  | MEDIUM   | No                  |
| KOBA-OPS-011  | MEDIUM   | No                  |
| KOBA-E2E-001  | MEDIUM   | No                  |
| KOBA-A11Y-001 | MEDIUM   | No                  |
| KOBA-GIT-003  | MEDIUM   | Condition           |
| KOBA-OPS-012  | LOW      | No                  |
| KOBA-SEC-016  | LOW      | No                  |

**Counts:** CRITICAL 0 · HIGH 14 · MEDIUM 23 · LOW 2 · INFORMATIONAL 8 (table in §5.4)

---

_End of Phase 15A audit. No fixes, commits, pushes, or production contact were performed._
