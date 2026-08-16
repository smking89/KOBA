# Staff MFA and privileged sessions

Phase 15C. Authenticator TOTP is mandatory for every KOBA staff identity (`SUPERADMIN`, `ADMIN`, `MODERATOR`). SMS is not a factor. Email codes are not the second factor. WebAuthn can be added later as another factor type; it is not implemented here.

## Assurance levels

- **AAL1** — password authentication (public JWT). Staff data is never granted at AAL1.
- **AAL2** — password plus verified TOTP/recovery code. Backed by an HttpOnly `koba_staff_aal2` cookie whose raw value is hashed in `StaffSession`.

Public account switching cannot mint AAL2. Elevation is bound to the user id in the database, not to the active KOBAID type in the JWT. Switching to Player/Business/Influencer does not copy staff authorization.

## Login flow

1. Email/password are checked (`POST /api/staff-mfa/login-start`). Failed attempts use a generic error (password vs MFA is not distinguished at this step).
2. Non-staff continue through Auth.js as before.
3. Staff without MFA get an AAL1 session and are sent only to `/settings/security/mfa`.
4. Staff with MFA do **not** receive a JWT from password alone. A 5-minute, single-purpose pending cookie is issued.
5. `POST /api/staff-mfa/challenge` verifies TOTP or a recovery code, rotates the privileged session, and returns a one-minute `mfaTicket`.
6. The client calls Auth.js `signIn` with that ticket only. Tickets are single-use and are not interchangeable with password-reset tokens or pending MFA cookies.
7. After success, the browser is redirected through `safeStaffCallbackPath` (`/admin`, `/settings/security`, `/enter`, `/dashboard` only).

## Enrollment

Enrollment requires an authenticated staff account, recent password confirmation, a newly generated TOTP secret, QR or manual setup key, a valid TOTP confirmation, recovery-code generation, an audit event, and revocation of older AAL2 sessions. MFA is not `ACTIVE` until the TOTP confirms. Abandoned enrollments expire after 15 minutes. The QR image is never stored.

## Encryption

TOTP secrets are sealed with AES-256-GCM (`KOBA_STAFF_MFA_ENCRYPTION_KEY`, 32 bytes base64). The key is purpose-separated from RCON (`KOBA_CREDENTIAL_ENCRYPTION_KEY`). Each ciphertext has a unique 12-byte IV, a 16-byte auth tag, a key version, and AAD bound to the user id. Missing keys fail closed in every environment.

Rotate:

1. Generate a new key (`openssl rand -base64 32`).
2. Keep the previous value as `KOBA_STAFF_MFA_ENCRYPTION_KEY_V{old}`.
3. Set `KOBA_STAFF_MFA_ENCRYPTION_KEY` to the new key and bump `KOBA_STAFF_MFA_KEY_VERSION`.
4. Existing rows decrypt with the version stored on the factor.

Never log secrets, recovery codes, pending tokens, or encryption keys.

## Recovery codes

Ten 80-bit codes are shown once at enrollment (copy or download). Only SHA-256 hashes are stored. Consumption uses `updateMany` where `usedAt` is null so concurrent reuse fails. Regeneration requires password + TOTP (and a fresh AAL2 step-up) and invalidates previous codes. Recovery codes are never emailed.

## Step-up

Highly sensitive staff actions require a fresh MFA verification inside `STAFF_STEPUP_WINDOW_MINUTES` (default 15). Password confirmation alone is not enough. If the window expired, the API returns `STEP_UP_REQUIRED`; the client posts `POST /api/staff-mfa/step-up` and retries. The original action is not replayed automatically.

Covered: refunds, staff KOBAID issuance, Plus grants, destructive moderation (hide/reject/suspend), publisher verify/suspend, administrative MFA reset, recovery-code regeneration, staff password change.

## Sessions

AAL2 idle timeout defaults to 60 minutes (`STAFF_SESSION_IDLE_MINUTES`); absolute lifetime 12 hours (`STAFF_SESSION_ABSOLUTE_HOURS`). Tokens are stored hashed. Logout clears the elevation cookie and Cache Storage. Password reset, password change, MFA enroll/disable/admin reset, and staff-role issuance revoke elevations. The sessions dashboard shows a truncated user-agent and an 8-character IP hash prefix — never a raw IP or token.

## Administrative recovery

If a staff member loses the authenticator **and** all recovery codes:

1. Another Superadmin with a fresh AAL2 step-up opens `/settings/security` or calls `POST /api/staff-mfa/reset`.
2. They supply the target email, a written reason (≥8 characters), and their own TOTP.
3. Self-reset is rejected. There is no bypass code.
4. The target’s factor is deleted, sessions are revoked, and they are emailed (best-effort; mail failure does not undo the reset).
5. The target must enroll again before staff tools work.

## Seed / local setup

1. Set `KOBA_STAFF_MFA_ENCRYPTION_KEY` (`openssl rand -base64 32`).
2. Seed as usual. No authenticator secret or recovery codes are written.
3. Sign in with the printed local staff password.
4. Enroll at `/settings/security/mfa`.
5. The VPS **must** use NTP. TOTP is server-time based with a documented ±30 second skew (`chrony` or `systemd-timesyncd`).

## Rate limits

Separate Redis-backed (or in-memory fallback) limits apply to login-start, MFA challenge, enrollment, recovery regeneration, step-up, admin reset, password change, and session revocation. Production should set Upstash (`KOBA-SEC-009`). Login-start rate-limit responses stay generic (`401`) to avoid account enumeration.

## PWA / caching

`/api/staff-mfa`, `/login/mfa`, `/admin`, and `/settings/security` are `Cache-Control: no-store`. The service worker never caches those paths. Logout revokes the elevation cookie and clears page caches.

## Emergency

`STAFF_MFA_ENFORCE=false` disables the enrollment/AAL2 requirement. Do not use this in production except as a documented incident response, and turn it back on immediately.

## Residual

- WebAuthn/passkeys are not implemented (factor table can add a type later).
- Public Auth.js JWTs remain 30 days (`KOBA-SEC-008`).
- Platform-wide user suspend/deletion is still `KOBA-SEC-012` (15F). Staff role _removal_ is not a product flow yet; issuing a staff KOBAID revokes that user’s AAL2 sessions.
- Staff MFA is not a substitute for backups, observability, legal pages, or live Stripe.
