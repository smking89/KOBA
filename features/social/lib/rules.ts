import { slugifyHandle } from "@/features/accounts/lib/handle";

export { slugifyHandle };

export const TAG_PRIVACY = ["EVERYONE", "FOLLOWERS", "NO_ONE"] as const;
export type TagPrivacy = (typeof TAG_PRIVACY)[number];

export const POST_VISIBILITY = ["PUBLIC", "FOLLOWERS"] as const;
export type PostVisibility = (typeof POST_VISIBILITY)[number];

export const TAG_TARGET_TYPES = ["USER", "SHOP", "GROUP", "PRODUCT"] as const;
export type TagTargetType = (typeof TAG_TARGET_TYPES)[number];

export function canFollowUser(input: {
  actorUserId: string;
  targetUserId: string;
  blocked: boolean;
}): boolean {
  return input.actorUserId !== input.targetUserId && !input.blocked;
}

export function canTagUser(input: {
  privacy: TagPrivacy;
  actorFollowsTarget: boolean;
  blocked: boolean;
  isSelf: boolean;
}): boolean {
  if (input.blocked) {
    return false;
  }
  if (input.isSelf) {
    return true;
  }
  if (input.privacy === "NO_ONE") {
    return false;
  }
  if (input.privacy === "FOLLOWERS") {
    return input.actorFollowsTarget;
  }
  return true;
}

/** Shop opt-out applies to every account type, including Influencer. */
export function canTagShop(taggingAllowed: boolean): boolean {
  return taggingAllowed;
}

export function influencerMayTagShop(taggingAllowed: boolean): boolean {
  return canTagShop(taggingAllowed);
}

export function canTagGroup(input: {
  taggingAllowed: boolean;
  isMember: boolean;
  visibility: string;
}): boolean {
  if (!input.taggingAllowed) {
    return false;
  }
  if (input.visibility === "PRIVATE") {
    return input.isMember;
  }
  return true;
}

export function canViewPost(input: {
  visibility: PostVisibility;
  moderationStatus: string;
  isAuthor: boolean;
  viewerFollowsAuthor: boolean;
  blocked: boolean;
}): boolean {
  if (input.moderationStatus !== "LIVE") {
    return input.isAuthor;
  }
  if (input.blocked) {
    return false;
  }
  if (input.visibility === "PUBLIC" || input.isAuthor) {
    return true;
  }
  return input.viewerFollowsAuthor;
}

export function isStoryActive(expiresAt: Date, now: Date): boolean {
  return now < expiresAt;
}

export function extractHandleMentions(body: string): string[] {
  const matches = body.match(/@([a-z0-9-]{2,32})/gi) ?? [];
  return [...new Set(matches.map((token) => token.slice(1).toLowerCase()))];
}

import { isAllowedMediaUrl } from "@/features/media/lib/storage";

export function isHttpsUrl(value: string): boolean {
  return isAllowedMediaUrl(value);
}

export function canModerateSocial(accountTypes: readonly string[]): boolean {
  return (
    accountTypes.includes("SUPERADMIN") ||
    accountTypes.includes("ADMIN") ||
    accountTypes.includes("MODERATOR")
  );
}
