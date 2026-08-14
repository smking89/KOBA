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
  (`KOBAID_REPOSITORY` DI token).
- `in-memory-kobaid.repository.ts` — the only implementation wired up this
  phase.
- `kobaid.service.ts` — `KobaidService`:
  - `mint()` — public self-registration path, community roles only
    (`PL`/`BZ`/`IN`). Enforces one KOBAID per (deviceId, role); retries CODE
    generation on collision (bounded, throws
    `KobaIdCollisionRetryExhaustedError` if exhausted).
  - `issueStaff()` — admin-issuance path, staff roles only (`SA`/`AD`/`MD`).
    Requires an existing staff `KobaId` as `issuedByKobaId`. Not exposed
    over HTTP this phase (no controller) — Phase 13 decides the route,
    gated by Phase 11's RBAC.
  - KOBAIDs are immutable: there is no update method anywhere in this
    module, intentionally.
- `kobaid.module.ts` — Nest module wiring `KobaidService` +
  `InMemoryKobaIdRepository` behind the `KOBAID_REPOSITORY` token.

## Storage decision: in-memory repository, not Prisma, this phase

`KobaIdRepository` is an interface; `InMemoryKobaIdRepository` is the only
implementation wired up right now. Real Postgres/Prisma models for `User`,
`Device`, `KobaId`, `Interest`, `UserInterest` were added to
`packages/database/prisma/schema.prisma` (validated with `prisma validate`)
so the target shape is locked in, but `apps/api` has no `@prisma/client`
dependency or generated client yet — wiring a `PrismaKobaIdRepository` is
a Phase 2+/Phase 12 follow-up, not part of this phase's scope. The seam
(`KobaIdRepository`) is designed so that swap doesn't touch `KobaidService`
or its tests.

## TDLS — deliberately unresolved

ROADMAP.md's open questions and the Phase 0 prototype reference "TDLS
encryption" for the KOBAID payload at rest/in transit, but the term isn't
defined anywhere in the repo. `kobaid.service.ts` marks the exact point
(right before persistence) where TDLS would apply, with a `TODO(TDLS)`
comment. KOBAIDs are stored as plain validated strings for now. No
cryptographic scheme has been invented here — this is pending the client's
answer.

## Explicitly out of scope this phase (left for later phases)

- HTTP controllers/routes for mint/issueStaff (Phase 13).
- Badge-icon suppression rendering rule (UI concern, ROADMAP Phase 1 item,
  not required by this pass's task scope — no `badge` field exists on
  `KobaId` at all, so there's nothing for a careless frontend to render,
  but the explicit server-side suppression check is not implemented here).
- `StaffIssuanceLog` audit trail table (ROADMAP mentions it; not built —
  `issuedByKobaId` on `KobaId` captures the minimum audit pointer for now).
- Prisma-backed repository implementation (see storage decision above).
