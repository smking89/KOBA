# kobaid

**Phase:** Phase 1
**Status:** implemented (service/DI layer, no HTTP routes yet)

KOBAID minting, format validation, one-per-role-per-device enforcement,
staff (admin) issuance, and referral-code/cosmetic-ownership metadata
placeholders.

## What's here

- `kobaid.types.ts` — `KobaIdRole` enum (`PL`/`BZ`/`IN` community,
  `SA`/`AD`/`MD` staff), the `KobaId` shape, and the community/staff role
  helpers.
- `kobaid-format.ts` — format (`KOBA-ROLE-CODE`), the ambiguity-excluded
  CODE alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ` — no `0`/`O`/`1`/`I`/`L`),
  and `generateCode()` (CSPRNG via `crypto.randomInt`, not `Math.random`).
- `kobaid.errors.ts` — typed domain errors: `InvalidKobaIdFormatError`,
  `DuplicateKobaIdForDeviceRoleError`, `StaffRoleRequiresAdminIssuanceError`,
  `CommunityRoleCannotBeStaffIssuedError`, `InvalidIssuerError`,
  `KobaIdCollisionRetryExhaustedError`.
- `kobaid.repository.ts` — `KobaIdRepository` storage interface
  (`KOBAID_REPOSITORY` DI token), including `findAllByDevice()` (used by
  switching to find every KOBAID on a device) and
  `getCosmeticOwnerships(kobaId)` (reads `cosmeticOwnershipRefs` — see
  "Cosmetic ownership" below).
- `in-memory-kobaid.repository.ts` — the only implementation wired up this
  phase.
- `staff-issuance-log.types.ts` / `staff-issuance-log.repository.ts` /
  `in-memory-staff-issuance-log.repository.ts` — the `StaffIssuanceLog`
  audit trail ROADMAP.md's Phase 1 section calls for (issuer KOBAID,
  issued KOBAID, target role, timestamp). Same interface-behind-in-memory-
  implementation pattern as `KobaIdRepository`, its own DI token
  (`STAFF_ISSUANCE_LOG_REPOSITORY`). A log entry is only ever written after
  `issueStaff()` has fully succeeded — nothing is logged for a failed/
  rejected issuance attempt.
- `kobaid.service.ts` — `KobaidService`:
  - `mint()` — public self-registration path, community roles only
    (`PL`/`BZ`/`IN`). Enforces one KOBAID per (deviceId, role); retries CODE
    generation on collision (bounded, throws
    `KobaIdCollisionRetryExhaustedError` if exhausted). Newly minted
    KOBAIDs start with `active: false`.
  - `issueStaff()` — admin-issuance path, staff roles only (`SA`/`AD`/`MD`).
    Requires an existing staff `KobaId` as `issuedByKobaId`. Records a
    `StaffIssuanceLogEntry` on success. Not exposed over HTTP this phase
    (no controller) — Phase 13 decides the route, gated by Phase 11's RBAC.
  - `getStaffIssuanceLog()` / `getStaffIssuanceLogByIssuer(issuerKobaId)` —
    read access to the audit log.
  - `activateForDevice(deviceId, role)` — Phase 2's switching primitive,
    pulled forward per a later task's scope. Marks the device's existing
    KOBAID for `role` active and any other active KOBAID on that device
    inactive; throws `KobaIdNotFoundForDeviceRoleError` if the device has
    no KOBAID for that role (switching never mints). Only the `active`
    flag changes — role/code/fullId/mintedAt are untouched, preserving
    immutability.
  - KOBAIDs are otherwise immutable: there is no general update method
    anywhere in this module, intentionally. `active` is the sole mutable
    field, and only `activateForDevice()` changes it.
  - `getCosmeticOwnerships(kobaId)` — read-only access to a KOBAID's
    `cosmeticOwnershipRefs` (see "Cosmetic ownership" below).
  - `exportForTransport(kobaId, peerId, masterKey)` /
    `importFromTransport(token, masterKey)` — TDLS-backed secure transport
    of an already-minted KOBAID's public fields between sandboxed
    functions/services. See "TDLS" below.
- `kobaid.module.ts` — Nest module wiring `KobaidService` +
  `InMemoryKobaIdRepository` behind `KOBAID_REPOSITORY`, and
  `InMemoryStaffIssuanceLogRepository` behind `STAFF_ISSUANCE_LOG_REPOSITORY`.

## Storage decision: in-memory repository, not Prisma, this phase

`KobaIdRepository` and `StaffIssuanceLogRepository` are interfaces;
`InMemoryKobaIdRepository` and `InMemoryStaffIssuanceLogRepository` are the
only implementations wired up right now. Real Postgres/Prisma models for
`User`, `Device`, `KobaId` (now including `active: Boolean @default(false)`),
`StaffIssuanceLog`, `Interest`, `UserInterest` were added to
`packages/database/prisma/schema.prisma` (validated with `prisma validate`)
so the target shape is locked in, but `apps/api` has no `@prisma/client`
dependency or generated client yet — wiring Prisma-backed repositories is
a Phase 2+/Phase 12 follow-up, not part of this phase's scope. The seams
(`KobaIdRepository`, `StaffIssuanceLogRepository`) are designed so that
swap doesn't touch `KobaidService` or its tests.

## Cosmetic ownership — visibility unaffected by mode switching

`KobaId.cosmeticOwnershipRefs` (see kobaid.types.ts) is the Phase 1
placeholder relation for owned cosmetics (Phase 3 owns the cosmetics
themselves — this module only models the shape). Nothing in this module
grants ownership yet; `KobaidService#getCosmeticOwnerships(kobaId)` /
`KobaIdRepository#getCosmeticOwnerships(kobaId)` exist as a read-only
query so `activateForDevice()` (switching) can be regression-tested
against ROADMAP.md's Phase 0/2 promise that cosmetic visibility never
changes with active mode — see `kobaid.service.spec.ts`'s
"cosmetic-visibility regression" suite, which mints two KOBAIDs on one
device, seeds ownership refs on both, switches active mode back and
forth between them, and asserts both KOBAIDs' ownership refs are
unchanged and queryable throughout.

## TDLS — transport security between sandboxed functions/services

The client has since defined TDLS: an ephemeral-symmetric-key envelope-
encryption scheme (AES-256-GCM) for handing data securely between two
sandboxed functions/services. It's implemented in `common/tdls/`
(`TdlsService`) — see `../../common/tdls/README.md` for the full
workflow/spec.

`KobaidService` wires it in at the transport boundary, additively (no
change to `mint()`/`issueStaff()`/`activateForDevice()`):

- `exportForTransport(kobaId, peerId, masterKey)` — wraps an
  already-minted KOBAID's transmissible fields (`fullId`, `role`,
  `mintedAt` — never the internal storage id) into a TDLS token.
- `importFromTransport(token, masterKey)` — validates and decrypts a
  token produced by `exportForTransport()`, returning those public
  fields. Purely a transport operation: it does not re-mint or look
  anything up in the repository.

`masterKey` is the pre-shared trust relationship between the two peers;
callers supply it — provisioning/distributing it is out of scope (see
`common/tdls/README.md`).

This is distinct from **at-rest (storage) encryption**, which is still an
open concern — see `packages/database/prisma/schema.prisma`'s
`TODO(TDLS)` note on the `KobaId` model. KOBAIDs are persisted as plain
validated strings/structs for now; TDLS does not change that.

## Explicitly out of scope this phase (left for later phases)

- HTTP controllers/routes for mint/issueStaff (Phase 13). (The account-
  *switching* endpoint is the one exception pulled forward — see
  accounts/README.md and accounts/account-switch.controller.ts.)
- Prisma-backed repository implementation (see storage decision above).

## Implemented in a later pass (still worth calling out here)

- **Badge-suppression rendering rule** — `resolveBadgeForKobaId()` now
  lives in the accounts module (`accounts/badge.resolver.ts`) since it
  also needs `CommunityRole`, an accounts-module concept. Staff KOBAIDs
  (`SA`/`AD`/`MD`) never render a badge, regardless of any community role
  passed in.
- **`StaffIssuanceLog` audit trail** — see `staff-issuance-log.*` above.
  `issuedByKobaId` on `KobaId` is still the minimum pointer for tracing;
  the log is the durable, queryable audit record.
- **Account switching (`activateForDevice`)** — see `kobaid.service.ts`
  above; the HTTP-facing side (`AccountSwitchService`,
  `POST /accounts/switch`) lives in the accounts module.
