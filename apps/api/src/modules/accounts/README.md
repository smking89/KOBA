# accounts

**Phase:** capability model built in Phase 1; Phase 2 (Account Switching
Flow) — see ROADMAP.md.
**Status:** capability-flag resolution (including the Phase 7 `adsPaused`
flag), tagging-permission resolution (the Phase 2/6 mode-to-permission
rule mapping), mandatory-interest validation, badge-suppression
resolution, and the account-switch service/endpoint are implemented. The
account-switching **settings UI** and Phase 6's actual tag
*enforcement*/rendering are still NOT implemented — see "Explicitly out of
scope" below.

## What's here

- `capability.types.ts` — `CapabilityFlags`, a typed flag set (not scattered
  booleans): `marketplaceBuy`, `marketplaceBid`, `groupsLfgDmsFeed`,
  `cosmeticInventory`, `shopTools`, `productUploads`, `adsCreation`,
  `devPortalAccess`, `promoPage`, `referralCodeManagement`,
  `earningsDashboard`, `adsPaused` (Phase 7's ad-pause-in-Player-mode
  flag — the ads module itself doesn't exist yet; this is just the
  mode-to-pause mapping for Phase 7 to consume later).
- `capability.service.ts` — `CapabilityService.resolve(role)`, pure/no I/O:
  - Player: marketplace buy/bid, groups/LFG/DMs/feed, cosmetic inventory,
    `adsPaused: true`. No shop tools, no dev portal, no promo page.
  - Business: every Player capability, plus shop tools, product uploads,
    ads, dev portal access; `adsPaused: false`.
  - Influencer: promo page, referral code management, earnings dashboard;
    `adsPaused: false`.
  - Staff roles (`SA`/`AD`/`MD`) throw
    `CapabilitiesNotDefinedForStaffRoleError` — staff permissions are
    Phase 11's RBAC model, not this one.
- `tagging-permission.types.ts` — `TaggingPermissions`, a typed flag set:
  `canTagAsPlayer`, `canTagShopProducts`, `canTagPromo`. This is the
  mode-to-permission *rule* mapping ROADMAP.md's Phase 2 "tagging
  permission changes per mode" deliverable calls for — Phase 6 (Social
  Layer) is what builds the actual `TagAction`/@mention model and
  enforces these rules; nothing here parses/renders/persists a tag.
- `tagging-permission.service.ts` — `TaggingPermissionService.resolve(role)`,
  pure/no I/O, same shape as `CapabilityService`:
  - Player: `canTagAsPlayer: true` only — can tag other players/shops/
    products in normal social contexts; cannot tag as a business or issue
    promotional tags.
  - Business: every Player tagging permission, plus
    `canTagShopProducts: true` (ROADMAP Phase 6: "Business mode enables
    shop/product tagging").
  - Influencer: every Player tagging permission, plus `canTagPromo: true`
    (ROADMAP Phase 6: "Influencer mode enables promo tagging").
  - Switching to Player mode naturally clears `canTagShopProducts`/
    `canTagPromo` (ROADMAP Phase 6: "Player mode disables business/
    influencer tagging") since those flags are per-resolve, not additive
    state.
  - Staff roles throw `TaggingPermissionsNotDefinedForStaffRoleError`.
- `interests.validator.ts` — `InterestsValidator`, enforcing "minimum 4
  selected interest hashtags before onboarded" (`MINIMUM_INTERESTS = 4`),
  case-insensitive/blank-filtered dedupe before counting.
  `assertSatisfied()` throws `InsufficientInterestsError` below the
  minimum. The interest catalog itself is not in scope — only the count
  rule and its typed error.
- `accounts.errors.ts` — `CapabilitiesNotDefinedForStaffRoleError`,
  `InsufficientInterestsError`, `TaggingPermissionsNotDefinedForStaffRoleError`.
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
  its `CapabilityFlags` — including `adsPaused` — its `BadgeResult`, and
  its `TaggingPermissions`).
- `account-switch.service.ts` — `AccountSwitchService.switchActiveRole()`:
  delegates activation to `KobaidService#activateForDevice()` (which
  enforces "must already exist, never mints, immutability preserved" — see
  kobaid/README.md), then resolves capabilities via `CapabilityService`,
  badge via `resolveBadgeForKobaId()`, and tagging permissions via
  `TaggingPermissionService` — all wired through the single
  `SwitchActiveRoleResult` response so callers don't need a second
  round-trip for tagging/ads-pause state.
- `account-switch.controller.ts` — `AccountSwitchController`, a thin Nest
  controller exposing `POST /accounts/switch` (body: `{ deviceId, role,
  communityRole? }`), the one HTTP route implemented so far in either
  module.
- `accounts.module.ts` — Nest module importing `KobaidModule`, wiring
  `AccountSwitchController`, and exporting `CapabilityService`,
  `InterestsValidator`, `AccountSwitchService`, `TaggingPermissionService`.

## Cosmetic-visibility-unaffected invariant

ROADMAP.md's Phase 0/2 design explicitly promises cosmetics stay visible
regardless of active mode. There's no cosmetics module yet (Phase 3), but
`KobaId.cosmeticOwnershipRefs` (see kobaid/README.md) is the Phase 1
placeholder relation for it, and `kobaid.service.spec.ts`'s
"cosmetic-visibility regression" suite proves `activateForDevice()`
(switching) never alters, deletes, or hides ownership refs for any
KOBAID on the device — before/after switching, both the newly-active and
newly-inactive KOBAIDs' ownership refs are unchanged and queryable via
`KobaidService#getCosmeticOwnerships()`.

## Explicitly out of scope this phase (Phase 6/7)

- The account-switching **UI** itself (settings screen) — only the backend
  service + endpoint are implemented.
- Tag *enforcement*/rendering against a real `TagAction`/@mention model
  (Phase 6) — only the permission *rules* (`TaggingPermissionService`)
  exist this phase, as ROADMAP.md's Phase 2 section scopes it.
- The ads module itself (Phase 7) — only the `adsPaused` flag exists for
  it to consume later.
- `AccountModeState` as its own persisted concept beyond `KobaId.active` —
  "last switched at" tracking, multi-user session state, etc.
