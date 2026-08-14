# tdls

**Status:** implemented — envelope-encryption transport security between
sandboxed functions/services.

TDLS ("Trusted Data Link Security") is the client's answer to the
`TODO(TDLS)` that previously sat at the KOBAID storage/transmission
boundary (see `../../modules/kobaid/kobaid.service.ts` and
`../../modules/kobaid/README.md`). Their spec, verbatim:

> The gold standard for this design is an Ephemeral Symmetric Key
> Architecture utilizing AES-GCM (Authenticated Encryption). Each
> sandboxed function generates transient, short-lived tokens/keys
> dynamically to talk to a specific peer, ensuring complete isolation.

```
[ Sandbox 1: Function A ] --- (1) Signs Token with Ephemeral Key ---> [ Sandbox 2: Function B ]
                          <-- (2) Validates, Extracts Session Key ---
                          <====== secure channel ======>
```

## What's here

- `tdls.types.ts` — `EphemeralKey` (keyId, 32-byte key, expiresAt) and
  `TdlsToken`, the opaque bundle handed between peers: `keyId`, `peerId`,
  `expiresAt`, the wrapped ephemeral key + its IV/auth tag, and the
  encrypted payload + its IV/auth tag.
- `tdls.errors.ts` — typed domain errors: `TdlsTokenExpiredError` (thrown
  when `expiresAt` has passed), `TdlsTokenInvalidError` (thrown when
  either AES-GCM auth tag fails to verify — covers both tampered
  ciphertext and an incorrect master key; AES-GCM authentication failures
  don't distinguish between the two, so this error doesn't either).
- `tdls.service.ts` — `TdlsService`:
  - `generateEphemeralKey()` — a fresh random AES-256-GCM key
    (`crypto.randomBytes(32)`), a unique `keyId` (`crypto.randomUUID()`),
    and a short TTL-based `expiresAt`. TTL defaults to
    `DEFAULT_EPHEMERAL_KEY_TTL_MS` (60s), overridable per instance via the
    `TDLS_EPHEMERAL_KEY_TTL_MS` DI token.
  - `issueToken(payload, peerId, masterKey)` — Function A's side.
    Generates a fresh ephemeral key (never cached/reused — single-purpose
    per call), wraps it under the caller-supplied `masterKey` (the
    pre-shared trust relationship with `peerId`; provisioning that key is
    out of scope here — no key-distribution/KMS system is built), then
    encrypts `payload` under the ephemeral key. Both encryption steps use
    real AES-256-GCM (`crypto.createCipheriv`) with a random IV per call
    and a captured auth tag. Returns a single opaque `TdlsToken`.
  - `validateAndExtract(token, masterKey)` — Function B's side. Rejects
    expired tokens (`TdlsTokenExpiredError`) before touching any key
    material. Unwraps the ephemeral key with `masterKey`, then decrypts
    the payload with it; either AES-GCM auth-tag failure (tampered
    ciphertext, or a `masterKey` that doesn't match what issued the
    token) throws `TdlsTokenInvalidError` rather than returning garbage.
- `tdls.module.ts` — Nest module wiring `TdlsService` as a provider/export.

## Explicitly out of scope

- **Master-key provisioning/distribution.** The master key represents a
  pre-existing trust relationship between two sandboxed functions/
  services; callers supply it. No KMS, rotation, or distribution protocol
  is built here.
- **At-rest (storage) encryption.** This module is about the transport/
  transmission boundary between services. Whether/how KOBAID (or any
  other) records are encrypted on disk is a separate, still-open concern —
  see `packages/database/prisma/schema.prisma`'s `TODO(TDLS)` note on the
  `KobaId` model.
