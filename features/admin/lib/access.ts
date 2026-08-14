import { isStaffAccountType } from "@/features/koba-id/lib/format";
import { canApproveListing, canVerifyShop } from "@/features/shops/lib/access";
import { canModerateSocial } from "@/features/social/lib/rules";
import { canIssueStaffRole } from "@/features/koba-id/lib/staff-auth";

export function isAnyStaff(actorAccountTypes: readonly string[]): boolean {
  return actorAccountTypes.some((type) => isStaffAccountType(type));
}

/** SA/AD may refund; MD cannot (matches payments/lib/staff). */
export function canStaffRefund(actorAccountTypes: readonly string[]): boolean {
  return actorAccountTypes.includes("SUPERADMIN") || actorAccountTypes.includes("ADMIN");
}

export function canStaffApproveListing(actorAccountTypes: readonly string[]): boolean {
  return canApproveListing(actorAccountTypes);
}

export function canStaffVerifyShop(actorAccountTypes: readonly string[]): boolean {
  return canVerifyShop(actorAccountTypes);
}

export function canStaffModerateContent(actorAccountTypes: readonly string[]): boolean {
  return canModerateSocial(actorAccountTypes);
}

export { canIssueStaffRole };
