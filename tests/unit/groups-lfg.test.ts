import { describe, expect, it } from "vitest";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { isSensitivePath, prefersNetworkFirst } from "@/lib/pwa/sensitive-routes";
import {
  canInviteToGroup,
  canJoinPublicGroup,
  canKickOrBan,
  canRequestPrivateGroup,
  canSetGroupRole,
  canViewPrivateGroup,
  isGroupCommunityRole,
  slugifyGroup,
} from "@/features/groups/lib/access";
import { createGroupSchema } from "@/features/groups/schemas/group.schemas";
import { generateLfgRef } from "@/features/lfg/lib/lfg-ref";
import {
  canAcceptLfgRequest,
  canRequestLfgSeat,
  nextFilledCount,
  resolveLfgStatus,
} from "@/features/lfg/lib/rules";
import { createLfgSchema, parseLfgQuery } from "@/features/lfg/schemas/lfg.schemas";

function bytesFromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((part) => Number.parseInt(part, 16)));
}

describe("group community roles vs KOBA staff", () => {
  it("treats group Owner/Admin/Moderator as community roles", () => {
    expect(isGroupCommunityRole("OWNER")).toBe(true);
    expect(isGroupCommunityRole("ADMIN")).toBe(true);
    expect(isGroupCommunityRole("MODERATOR")).toBe(true);
    expect(isGroupCommunityRole("MEMBER")).toBe(true);
    expect(isStaffAccountType("ADMIN")).toBe(true);
    expect(isStaffAccountType("MODERATOR")).toBe(true);
    expect(isGroupCommunityRole("SUPERADMIN")).toBe(false);
  });

  it("lets anyone join a public group unless banned or already a member", () => {
    expect(canJoinPublicGroup({ alreadyMember: false, banned: false })).toBe(true);
    expect(canJoinPublicGroup({ alreadyMember: true, banned: false })).toBe(false);
    expect(canJoinPublicGroup({ alreadyMember: false, banned: true })).toBe(false);
  });

  it("requires a request for private groups", () => {
    expect(
      canRequestPrivateGroup({ alreadyMember: false, banned: false, pendingRequest: false }),
    ).toBe(true);
    expect(
      canRequestPrivateGroup({ alreadyMember: false, banned: false, pendingRequest: true }),
    ).toBe(false);
    expect(canViewPrivateGroup({ isMember: false, hasPendingInvite: false })).toBe(false);
    expect(canViewPrivateGroup({ isMember: false, hasPendingInvite: true })).toBe(true);
  });

  it("keeps kick/ban ranked below the actor and never above the owner", () => {
    expect(canKickOrBan({ actorRole: "MODERATOR", targetRole: "MEMBER" })).toBe(true);
    expect(canKickOrBan({ actorRole: "MODERATOR", targetRole: "ADMIN" })).toBe(false);
    expect(canKickOrBan({ actorRole: "ADMIN", targetRole: "OWNER" })).toBe(false);
    expect(canInviteToGroup("MEMBER")).toBe(false);
    expect(canInviteToGroup("ADMIN")).toBe(true);
  });

  it("lets owners assign admin/mod, but never reassign owner", () => {
    expect(canSetGroupRole({ actorRole: "OWNER", targetRole: "MEMBER", nextRole: "ADMIN" })).toBe(
      true,
    );
    expect(canSetGroupRole({ actorRole: "OWNER", targetRole: "OWNER", nextRole: "ADMIN" })).toBe(
      false,
    );
    expect(canSetGroupRole({ actorRole: "ADMIN", targetRole: "MEMBER", nextRole: "ADMIN" })).toBe(
      false,
    );
  });

  it("slugifies group names", () => {
    expect(slugifyGroup("Rust Legacy Raiders")).toBe("rust-legacy-raiders");
    expect(createGroupSchema.safeParse({ name: "A", bio: "short" }).success).toBe(false);
  });
});

describe("LFG matching", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");

  it("expires open posts and fills the roster", () => {
    expect(
      resolveLfgStatus({
        status: "OPEN",
        expiresAt: new Date("2026-08-14T11:00:00.000Z"),
        slotsFilled: 2,
        slotsTotal: 5,
        now,
      }),
    ).toBe("EXPIRED");
    expect(nextFilledCount(4, 5)).toEqual({ slotsFilled: 5, status: "FULL" });
    expect(nextFilledCount(2, 5)).toEqual({ slotsFilled: 3, status: "OPEN" });
  });

  it("blocks the author from requesting their own seat", () => {
    expect(
      canRequestLfgSeat({
        viewerUserId: "author",
        authorUserId: "author",
        status: "OPEN",
        alreadyRequested: false,
      }),
    ).toBe(false);
    expect(
      canRequestLfgSeat({
        viewerUserId: "player",
        authorUserId: "author",
        status: "OPEN",
        alreadyRequested: false,
      }),
    ).toBe(true);
    expect(
      canRequestLfgSeat({
        viewerUserId: "player",
        authorUserId: "author",
        status: "EXPIRED",
        alreadyRequested: false,
      }),
    ).toBe(false);
  });

  it("lets only the author accept a pending request on an open post", () => {
    expect(
      canAcceptLfgRequest({
        actorUserId: "author",
        authorUserId: "author",
        status: "OPEN",
        requestStatus: "PENDING",
      }),
    ).toBe(true);
    expect(
      canAcceptLfgRequest({
        actorUserId: "other",
        authorUserId: "author",
        status: "OPEN",
        requestStatus: "PENDING",
      }),
    ).toBe(false);
  });

  it("parses LFG filters and mints public refs", () => {
    const query = parseLfgQuery({ game: "rust", platform: "STEAM", region: "NA", mic: "REQUIRED" });
    expect(query.game).toBe("rust");
    expect(query.platform).toBe("STEAM");
    expect(generateLfgRef(() => bytesFromHex("cafebabe"))).toBe("KOBA-LFG-CAFEBABE");
    expect(
      createLfgSchema.safeParse({
        title: "Wipe Day Squad",
        body: "Full wipe, mic required.",
        gameSlug: "rust",
        platform: "STEAM",
        region: "NA",
        timezone: "America/New_York",
        skillLevel: "INTERMEDIATE",
        mic: "REQUIRED",
        availability: "Wipe night",
        slotsTotal: 5,
        expiresInHours: 4,
      }).success,
    ).toBe(true);
  });
});

describe("groups and LFG routes", () => {
  it("never caches membership or LFG APIs", () => {
    expect(isSensitivePath("/api/groups/rust-legacy-raiders/join")).toBe(true);
    expect(isSensitivePath("/api/lfg/KOBA-LFG-CAFEBABE/join")).toBe(true);
    expect(prefersNetworkFirst("/groups")).toBe(true);
    expect(prefersNetworkFirst("/lfg")).toBe(true);
  });
});
