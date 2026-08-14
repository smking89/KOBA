export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "shop";
}

export const SHOP_MEMBER_ROLES = ["OWNER", "MODERATOR"] as const;
export type ShopMemberRole = (typeof SHOP_MEMBER_ROLES)[number];

export const SHOP_VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;
export type ShopVerificationStatus = (typeof SHOP_VERIFICATION_STATUSES)[number];

/** Shop Admin/Moderator are community roles, never KOBA staff (SA/AD/MD). */
export function isShopCommunityRole(role: string): role is ShopMemberRole {
  return (SHOP_MEMBER_ROLES as readonly string[]).includes(role);
}

export function canManageShop(input: {
  userId: string;
  ownerUserId: string;
  memberUserIds: readonly string[];
}): boolean {
  return input.userId === input.ownerUserId || input.memberUserIds.includes(input.userId);
}

export function canCreateShop(input: {
  hasBusinessIdentity: boolean;
  alreadyOwnsShop: boolean;
}): boolean {
  return input.hasBusinessIdentity && !input.alreadyOwnsShop;
}

export function canFollowOrReviewShop(input: { userId: string; ownerUserId: string }): boolean {
  return input.userId !== input.ownerUserId;
}

export function canVerifyShop(actorAccountTypes: readonly string[]): boolean {
  return actorAccountTypes.includes("SUPERADMIN") || actorAccountTypes.includes("ADMIN");
}

/** Sellers create drafts and submit for review. They never set APPROVED. */
export const SELLER_CREATE_STATUS = "DRAFT" as const;
export const SELLER_SUBMIT_STATUS = "PENDING" as const;

/** KOBA staff (SA/AD/MD) may approve listings. Shop Moderator cannot. */
export function canApproveListing(actorAccountTypes: readonly string[]): boolean {
  return (
    actorAccountTypes.includes("SUPERADMIN") ||
    actorAccountTypes.includes("ADMIN") ||
    actorAccountTypes.includes("MODERATOR")
  );
}
