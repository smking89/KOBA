import type { KobaAccountType } from "@/features/koba-id/lib/format";

export function canStaffVerifyInfluencer(actorAccountTypes: readonly string[]): boolean {
  return actorAccountTypes.includes("SUPERADMIN") || actorAccountTypes.includes("ADMIN");
}

export function canStaffModeratePromotions(actorAccountTypes: readonly string[]): boolean {
  return (
    actorAccountTypes.includes("SUPERADMIN") ||
    actorAccountTypes.includes("ADMIN") ||
    actorAccountTypes.includes("MODERATOR")
  );
}

export function hasInfluencerIdentity(
  identities: readonly { accountType: KobaAccountType }[],
): boolean {
  return identities.some((row) => row.accountType === "INFLUENCER");
}

export function hasBusinessIdentity(
  identities: readonly { accountType: KobaAccountType }[],
): boolean {
  return identities.some((row) => row.accountType === "BUSINESS");
}
