import { describe, expect, it } from "vitest";
import { isGroupCommunityRole } from "@/features/groups/lib/access";
import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { isSensitivePath, prefersNetworkFirst } from "@/lib/pwa/sensitive-routes";
import { generatePostRef, generateStoryRef } from "@/features/social/lib/refs";
import {
  canFollowUser,
  canModerateSocial,
  canTagUser,
  canViewPost,
  extractHandleMentions,
  isHttpsUrl,
  isStoryActive,
} from "@/features/social/lib/rules";
import { parseFeedQuery } from "@/features/social/schemas/social.schemas";

function bytesFromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((part) => Number.parseInt(part, 16)));
}

describe("tag privacy and blocks", () => {
  it("never lets a blocked account tag, even when privacy is everyone", () => {
    expect(
      canTagUser({
        privacy: "EVERYONE",
        actorFollowsTarget: true,
        blocked: true,
        isSelf: false,
      }),
    ).toBe(false);
    expect(
      canTagUser({
        privacy: "FOLLOWERS",
        actorFollowsTarget: false,
        blocked: false,
        isSelf: false,
      }),
    ).toBe(false);
    expect(
      canTagUser({
        privacy: "NO_ONE",
        actorFollowsTarget: true,
        blocked: false,
        isSelf: false,
      }),
    ).toBe(false);
    expect(
      canTagUser({
        privacy: "NO_ONE",
        actorFollowsTarget: false,
        blocked: false,
        isSelf: true,
      }),
    ).toBe(true);
  });

  it("blocks self-follow", () => {
    expect(canFollowUser({ actorUserId: "a", targetUserId: "a", blocked: false })).toBe(false);
    expect(canFollowUser({ actorUserId: "a", targetUserId: "b", blocked: true })).toBe(false);
    expect(canFollowUser({ actorUserId: "a", targetUserId: "b", blocked: false })).toBe(true);
  });
});

describe("feed visibility", () => {
  it("hides followers-only posts from non-followers", () => {
    expect(
      canViewPost({
        visibility: "FOLLOWERS",
        moderationStatus: "LIVE",
        isAuthor: false,
        viewerFollowsAuthor: false,
        blocked: false,
      }),
    ).toBe(false);
    expect(
      canViewPost({
        visibility: "FOLLOWERS",
        moderationStatus: "LIVE",
        isAuthor: false,
        viewerFollowsAuthor: true,
        blocked: false,
      }),
    ).toBe(true);
    expect(
      canViewPost({
        visibility: "PUBLIC",
        moderationStatus: "HIDDEN",
        isAuthor: false,
        viewerFollowsAuthor: true,
        blocked: false,
      }),
    ).toBe(false);
    expect(
      canViewPost({
        visibility: "PUBLIC",
        moderationStatus: "LIVE",
        isAuthor: false,
        viewerFollowsAuthor: false,
        blocked: true,
      }),
    ).toBe(false);
  });

  it("parses @handle mentions from post bodies", () => {
    expect(extractHandleMentions("kits from @Ironwright and @maxbuilds")).toEqual([
      "ironwright",
      "maxbuilds",
    ]);
    expect(parseFeedQuery({ page: "2", group: "rust-legacy-raiders" })).toMatchObject({
      page: 2,
      group: "rust-legacy-raiders",
    });
    expect(parseFeedQuery({ page: "3", handle: "maxbuilds" })).toMatchObject({
      page: 3,
      handle: "maxbuilds",
    });
  });

  it("requires https for media URLs", () => {
    expect(isHttpsUrl("https://cdn.koba.example/shot.png")).toBe(true);
    expect(isHttpsUrl("http://cdn.koba.example/shot.png")).toBe(false);
    expect(isHttpsUrl("not-a-url")).toBe(false);
  });
});

describe("social moderation", () => {
  it("lets KOBA staff hide posts, not group community mods", () => {
    expect(canModerateSocial(["SUPERADMIN"])).toBe(true);
    expect(canModerateSocial(["ADMIN"])).toBe(true);
    expect(canModerateSocial(["MODERATOR"])).toBe(true);
    expect(canModerateSocial(["PLAYER"])).toBe(false);
    expect(isGroupCommunityRole("MODERATOR")).toBe(true);
    expect(isStaffAccountType("MODERATOR")).toBe(true);
    expect(isGroupCommunityRole("OWNER")).toBe(true);
    expect(isStaffAccountType("PLAYER")).toBe(false);
  });

  it("expires stories after 24 hours", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    expect(isStoryActive(new Date("2026-08-15T11:59:00.000Z"), now)).toBe(true);
    expect(isStoryActive(new Date("2026-08-14T11:00:00.000Z"), now)).toBe(false);
    expect(generatePostRef(() => bytesFromHex("cafebabe"))).toBe("KOBA-PST-CAFEBABE");
    expect(generateStoryRef(() => bytesFromHex("deadbeef"))).toBe("KOBA-STY-DEADBEEF");
  });
});

describe("social routes", () => {
  it("never caches social APIs and prefers network for profiles", () => {
    expect(isSensitivePath("/api/social/feed")).toBe(true);
    expect(isSensitivePath("/api/social/follow/maxbuilds")).toBe(true);
    expect(isSensitivePath("/api/admin/posts/KOBA-PST-CAFEBABE/hide")).toBe(true);
    expect(prefersNetworkFirst("/u/maxbuilds")).toBe(true);
    expect(prefersNetworkFirst("/feed")).toBe(true);
    expect(prefersNetworkFirst("/stories/KOBA-STY-WIPE0001")).toBe(true);
  });
});
