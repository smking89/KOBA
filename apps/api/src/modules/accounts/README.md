# accounts

**Phase:** capability model built in Phase 1 (per this pass's task scope);
mode-switching flow/endpoint is still Phase 2 — see ROADMAP.md.
**Status:** capability-flag resolution + mandatory-interest validation
implemented; mode switching (`AccountModeState`, the switch endpoint, tag
permission enforcement) is NOT implemented — that's Phase 2 scope.

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
- `accounts.module.ts` — Nest module exporting both services.

## Explicitly out of scope this phase (Phase 2+)

- `AccountModeState` (active KOBAID/role per user, last-switched-at).
- The mode-switch HTTP endpoint and settings UI.
- `TagPermissionRule` (role → allowed tag actions) — schema/enforcement.
- Regression coverage for "cosmetic visibility must not change on mode
  switch" (there's no mode-switch code yet for that to regress against).
