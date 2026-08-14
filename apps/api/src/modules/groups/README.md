# groups

**Phase:** Phase 5
**Status:** implemented (service/DI layer, no HTTP routes yet — same
posture as Phase 1's kobaid module, Phase 3's marketplace module, and
Phase 4's shops module)

Groups (public/private), community roles (Owner/Admin/Moderator/Member),
group feed, LFG posts + expiration. `Group` and `LFG` are kept as two
related but distinct concerns per ROADMAP.md's Phase 5 text — separate
service files (`group*.service.ts` vs `lfg.service.ts`), not one giant
service.

## What's here

- `group.types.ts` — `Group` (id/ownerKobaId/createdAt immutable once
  created — no update path for them anywhere in this module —
  `visibility`/`allowTagging` ARE editable), `CreateGroupParams`,
  `GroupMembership` (reuses `accounts/community-role.types.ts`'s
  `CommunityRole` — deliberately **not** redefined here, see that file's
  docstring for why), `GroupMemberWithBadge` (a `GroupMembership` composed
  with `accounts/badge.resolver.ts`'s `BadgeResult`), `GroupPost`,
  `CreateGroupPostParams`.
- `group.errors.ts` — typed domain errors (`GroupDomainError` base class,
  same pattern as `shops/shop.errors.ts`): `GroupNotFoundError`,
  `NotGroupMemberError`, `PrivateGroupRequiresMembershipError`,
  `PrivateGroupJoinRequiresInviteError`, `InsufficientGroupRoleError`,
  `CannotModifyOwnerRoleError`, `CannotAssignOwnerRoleError`,
  `CannotAssignRoleAboveOwnRankError`.
- `group.repository.ts` / `in-memory-group.repository.ts`,
  `group-membership.repository.ts` / `in-memory-group-membership.repository.ts`,
  `group-post.repository.ts` / `in-memory-group-post.repository.ts` —
  interface-behind-in-memory-implementation, same pattern as
  `shops/shop.repository.ts` (see "Storage decision" below).
- `group.service.ts` — `GroupService`:
  - `createGroup()` — `ownerKobaId` is set once and never mutated
    anywhere in this module (same "immutable owner" posture as
    `shops/shop.service.ts#createShop()`). Auto-creates a
    `GroupMembership` row assigning the owner the `owner` `CommunityRole`
    in the same call.
  - `getById()` / `findById()`.
  - `setAllowTagging()` / `isTaggingAllowed()` — owner/admin-controlled
    tag-permission flag, defaults `true`, same shape as
    `shops/shop.service.ts`'s `allowTagging`. Config only, **no tag
    enforcement anywhere in this module** (that's Phase 6).
- `group-membership.service.ts` — `GroupMembershipService`:
  - `isMember()` / `getMembership()` / `listMembers()`.
  - `listMembersWithBadges()` — thin composition of `listMembers()` with
    `accounts/badge.resolver.ts#resolveBadgeForKobaId()` for the Group
    Page member list (Owner/Admin/Moderator badge icons from the Phase 0
    design). Reads the member's `KobaIdRole` structurally off their
    KOBAID string via `kobaid/kobaid-format.ts`'s `KOBA_ID_PATTERN` — no
    new cosmetic/badge modeling, no required-to-exist KobaId lookup.
  - `join()` — joining a **public** group is open to any KobaId
    (idempotent — joining twice returns the existing membership
    unchanged). Joining a **private** group this way always throws
    `PrivateGroupJoinRequiresInviteError` — see "Explicitly out of scope"
    below for the gap this leaves.
  - `addMember()` — owner/admin-only; directly adds a member (default role
    `member`) regardless of the group's visibility — this is the only way
    to populate a private group's membership this phase. Idempotent.
    Rejects assigning the `owner` role (`CannotAssignOwnerRoleError`).
  - `setRole()` — promotes/demotes a member's `CommunityRole`. Only the
    group's owner/admin may call it (`InsufficientGroupRoleError`
    otherwise). The owner's own role can never be changed
    (`CannotModifyOwnerRoleError`), and no one can be assigned `owner`
    (`CannotAssignOwnerRoleError` — no ownership-transfer path this
    phase). A caller may only assign a role **strictly below their own
    rank** (owner > admin > moderator > member) — this is what prevents a
    member from promoting themselves (or anyone else) above their current
    role (`CannotAssignRoleAboveOwnRankError`); e.g. an admin can appoint
    a moderator/member but never another admin.
- `group-feed.service.ts` — `GroupFeedService`:
  - `getGroupFeed(groupId, requesterKobaId?)` — public groups have no
    viewing restriction (including an anonymous/omitted requester).
    Private groups require the requester to currently be a member
    (`PrivateGroupRequiresMembershipError` otherwise). This is the
    enforcement point ROADMAP.md's "a private group requires membership
    to view its feed/posts" deliverable maps to.
  - `createPost()` — posting requires the author to currently be a member
    (`NotGroupMemberError` otherwise). A lightweight text post
    (id/groupId/authorKobaId/text/createdAt) — **not** Phase 6's full
    social layer (no likes/comments/shares/tagging enforcement); just
    enough of a "group feed" concept to exist and be queryable, matching
    the Phase 0 Group Page mockup's simple text feed. Builds the data
    shape now, per ROADMAP.md's "wire it into the ranked feed [Phase 8]
    later" soft dependency.
- `lfg.types.ts` — `LfgPost` (id/authorKobaId/groupId [nullable —
  standalone LFG posts are first-class]/game/mode/requirementsText/
  maxSlots/filledSlots/expiresAt/createdAt), `CreateLfgPostParams`.
- `lfg.errors.ts` — typed domain errors (`LfgDomainError` base class):
  `LfgPostNotFoundError`, `InvalidMaxSlotsError`, `LfgPostExpiredError`,
  `LfgPostFullError`, `AlreadyJoinedLfgPostError`.
- `lfg.repository.ts` / `in-memory-lfg.repository.ts` — same
  interface-behind-in-memory-implementation pattern, plus a join ledger
  (`hasJoined()`/`recordJoin()`) so a duplicate join by the same KOBAID is
  detected without adding a participant list to the public `LfgPost`
  shape.
- `lfg.service.ts` — `LfgService`:
  - `createLfgPost()` — validates `maxSlots` is a positive integer
    (`InvalidMaxSlotsError` otherwise); `filledSlots` always starts at 0.
    `groupId` is optional/nullable, per the Phase 0 design's standalone
    LFG Page.
  - `isExpired(post, now?)` — no background scheduler/mutable status
    field, same posture as `marketplace/auction.service.ts#hasEnded()`:
    just checks `expiresAt < now` at read time. `now` is injectable so
    tests can assert expiry at multiple points in time without depending
    on the real clock.
  - `joinLfgPost()` — increments `filledSlots`. Typed errors, checked in
    this order: `LfgPostExpiredError` (expiresAt already passed),
    `AlreadyJoinedLfgPostError` (same kobaId joining a second time — a
    slot is never double-counted for one person; this was a deliberate
    "typed error, not idempotent no-op" choice, matching the literal "typed
    errors for... same kobaId joining twice" phrasing in this module's
    spec), `LfgPostFullError` (filledSlots already at maxSlots).
- `groups.module.ts` — Nest module wiring every service above behind
  their repository DI tokens. Reuses `accounts/`'s `CommunityRole` enum
  and `resolveBadgeForKobaId()` via **plain TypeScript import**, not a
  Nest module import — both are framework-free (no `@Injectable`, and
  neither is in `AccountsModule`'s `providers`/`exports` list), so there
  is no DI service to inject and therefore no need to import
  `AccountsModule` here (unlike `shops.module.ts` importing
  `MarketplaceModule` to inject actual stateful services like
  `ProductService`). **`accounts/` itself was not modified by this
  module** — see "What changed in accounts/" below. **Not yet imported by
  `AppModule`** — same posture as `marketplace.module.ts`/`shops.module.ts`.

## What changed in `accounts/`

**Nothing.** `CommunityRole` (`accounts/community-role.types.ts`) and
`resolveBadgeForKobaId()` (`accounts/badge.resolver.ts`) already existed
exactly as needed — both were built ahead of this phase specifically so
Phase 5 could reuse them (see their docstrings). This module only adds
plain TypeScript imports of those two files; no accounts/ file was edited.

## Storage decision: in-memory repositories, not Prisma, this phase

Same rationale and pattern as `kobaid/kobaid.repository.ts` and
`shops/shop.repository.ts` — see those modules' READMEs. `GroupRepository`,
`GroupMembershipRepository`, `GroupPostRepository`, and `LfgPostRepository`
are interfaces; the `InMemory*` classes are the only implementations
wired up right now. `Group`, `GroupMembership`, `GroupPost`, and `LfgPost`
Prisma models (plus the `CommunityRole`/`GroupVisibility` enums) were
added to `packages/database/prisma/schema.prisma` — additive only,
validated with `prisma validate` — so the target shape is locked in ahead
of Phase 12. `apps/api` still has no `@prisma/client` dependency or
generated client; wiring Prisma-backed repositories is a later-phase
follow-up.

## Explicitly out of scope this phase (left for later)

- **TODO — invite/request-to-join flow for private groups.** This phase
  models the simplest thing that satisfies "a private group requires
  membership to view its feed": an owner/admin can add a member directly
  via `GroupMembershipService#addMember()`. There is no self-service
  "request to join" flow, no invite-code system, and no approval queue —
  `join()` on a private group always throws
  `PrivateGroupJoinRequiresInviteError`. A real invite/request flow is a
  genuine gap for a later phase.
- **TODO — real Phase 6 tagging enforcement.** `Group.allowTagging` is a
  flag + query method only (`GroupService#setAllowTagging()` /
  `#isTaggingAllowed()`), same non-goal as `shops/shop.service.ts`'s
  `allowTagging`. Nothing in this module (or anywhere in the codebase
  yet) actually enforces it against a real `TagAction`/@mention model.
- **TODO — LFG auto-expiry scheduler/notification.** `LfgService#isExpired()`
  is a pure clock check at read time — there is no background job that
  flips a stored status, sends an "your LFG post expired" notification,
  or removes expired posts from a listing. Same posture as
  `marketplace/auction.service.ts`'s `endsAt` handling; a real scheduler
  (BullMQ, per ROADMAP.md's tech-stack table) is a later-phase follow-up.
- **TODO — group-level Stripe/monetization**, if ever wanted (nothing in
  ROADMAP.md's Phase 5 section asks for this — noted only because it's an
  easy thing to assume-in by analogy with `shops/`'s Stripe Connect
  wrapper; not built here).
- **`GroupTagPermissionRule` (per-role tag-action rules)** — ROADMAP.md's
  Phase 5 data-model sketch mentions `GroupTagPermissionRule (group_id,
  community_role → allowed tag actions)`. Not modeled here: this phase
  only ships the single group-level `allowTagging` boolean (config, no
  enforcement), matching the granularity `shops/` already established for
  its own tag flag. Per-role tag-action rules are Phase 6's job, when the
  real `TagAction` engine exists to enforce them.
- **Real Phase 6 social layer** (likes/comments/shares/tagging
  enforcement on `GroupPost`), **Phase 6 DMs/social actions**, and
  **Phase 10 influencer referral tied to groups** — none of these are
  built here, per this task's explicit constraints.
- **HTTP controllers/routes** — same as kobaid/marketplace/shops: Phase
  13 decides the route surface, gated by Phase 11's RBAC / Phase 1-2's
  capability flags.

## Tests

42 real Jest tests across `group.service.spec.ts`,
`group-membership.service.spec.ts`, `group-feed.service.spec.ts`,
`lfg.service.spec.ts`, and `groups.module.spec.ts` (DI wiring), covering:
group creation + immutable owner, private-group-feed-requires-membership
enforcement, public-group-open-viewing, role promotion/demotion
authorization rules (owner/admin only, self-promotion-above-own-rank
rejected, owner un-demotable/un-reassignable), `addMember()` to a private
group, group-feed posting requires membership, `allowTagging`
default+toggle (owner and admin), `listMembersWithBadges()` composition
with `resolveBadgeForKobaId()`, and the full LFG surface (join increments
`filledSlots`, join rejected when full, join rejected when expired,
duplicate join by the same kobaId rejected, expired-status derived from
the clock at multiple time points, standalone no-`groupId` LFG posts).
