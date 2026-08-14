# accounts

**Phase:** capability model built in Phase 1; badge-suppression rendering
and a tightly-scoped slice of Phase 2's account switching (the
`POST /accounts/switch` endpoint only — not the full flow) pulled forward
in a later pass — see ROADMAP.md.
**Status:** capability-flag resolution, mandatory-interest validation,
badge-suppression resolution, and the account-switch service/endpoint are
implemented. The full Phase 2 flow (settings UI, tag-permission
enforcement, ad-pausing) is still NOT implemented — see "Explicitly out of
scope" below.

## What's here

- `capability.types.ts` — `CapabilityFlags`, a typed flag set (not scattered
  booleans): `marketplaceBuy`, `marketplaceBid`, `groupsLfgDmsFeed`,
  `cosmeticInventory`, `shopTools`, `productUploads`, `adsCreation`,
  `devPortalAccess`, `promoPage`, `referralCodeManagement`,
  `earningsDashboard`.
- `capability.service.ts` — `CapabilityService.resolve(role)`, pure/no I/O:
  - Player: marketplace buy/bid, groups/LFG/DMs/feed, cosmetic inventory.
    No shop tools, no dev portal, no promo page.
  - Business: every Player capability, plus shop tools, product uploads,
    ads, dev portal access.
  - Influencer: promo page, referral code management, earnings dashboard.
  - Staff roles (`SA`/`AD`/`MD`) throw
    `CapabilitiesNotDefinedForStaffRoleError` — staff permissions are
    Phase 11's RBAC model, not this one.
- `interests.validator.ts` — `InterestsValidator`, enforcing "minimum 4
  selected interest hashtags before onboarded" (`MINIMUM_INTERESTS = 4`),
  case-insensitive/blank-filtered dedupe before counting.
  `assertSatisfied()` throws `InsufficientInterestsError` below the
  minimum. The interest catalog itself is not in scope — only the count
  rule and its typed error.
- `accounts.errors.ts` — `CapabilitiesNotDefinedForStaffRoleError`,
  `InsufficientInterestsError`.
- `community-role.types.ts` — `CommunityRole` enum
  (`owner`/`admin`/`moderator`/`member`): a Group/Shop-scoped role attached
  to a normal Player/Business KOBAID. Deliberately a *separate* concept
  from `KobaIdRole`'s staff roles (SA/AD/MD) — ROADMAP.md's Phase 5/11
  sections call this distinction out as a hard requirement. This is the
  smallest possible shape to make badge resolution meaningful/testable; it
  is NOT Phase 5's Groups module (no membership storage, no group CRUD).
- `badge.types.ts` — `BadgeResult`, a discriminated union
  (`{ showBadge: false }` or `{ showBadge: true; badgeType: 'admin' |
  'moderator' }`).
- `badge.resolver.ts` — `resolveBadgeForKobaId(kobaId, communityRole?)`, a
  pure presentation function (no frontend-framework dependency, since
  apps/web isn't bootstrapped yet):
  - Staff KOBAIDs (`SA`/`AD`/`MD`) never show a badge, regardless of any
    `communityRole` passed — they're identified only by KOBAID format.
  - Community-role `admin`/`owner` → `{ showBadge: true, badgeType:
    'admin' }`; `moderator` → `{ showBadge: true, badgeType: 'moderator'
    }`; `member`/no role → `{ showBadge: false }`.
- `account-switch.types.ts` — `SwitchActiveRoleParams`/
  `SwitchActiveRoleResult` (the latter bundling the newly-active `KobaId`,
  its `CapabilityFlags`, and its `BadgeResult`).
- `account-switch.service.ts` — `AccountSwitchService.switchActiveRole()`:
  delegates activation to `KobaidService#activateForDevice()` (which
  enforces "must already exist, never mints, immutability preserved" — see
  kobaid/README.md), then resolves capabilities via `CapabilityService`
  and badge via `resolveBadgeForKobaId()`.
- `account-switch.controller.ts` — `AccountSwitchController`, a thin Nest
  controller exposing `POST /accounts/switch` (body: `{ deviceId, role,
  communityRole? }`), the one HTTP route implemented so far in either
  module.
- `accounts.module.ts` — Nest module importing `KobaidModule`, wiring
  `AccountSwitchController`, and exporting `CapabilityService`,
  `InterestsValidator`, `AccountSwitchService`.

## Explicitly out of scope this phase (Phase 2/6/7)

- The account-switching **UI** itself (settings screen) — only the backend
  service + endpoint are implemented.
- Tagging-permission enforcement on switch (`TagPermissionRule`, Phase 6).
- Ad-pausing in Player mode (Phase 7).
- `AccountModeState` as its own persisted concept beyond `KobaId.active` —
  "last switched at" tracking, multi-user session state, etc.
- Regression coverage for "cosmetic visibility must not change on mode
  switch" — no cosmetics module exists yet for that to regress against.
