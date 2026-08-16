import type { DeveloperMemberRole } from "@/lib/generated/prisma/client";

export const DESTRUCTIVE_ROLES: readonly DeveloperMemberRole[] = ["OWNER"];
export const SECRET_ROLES: readonly DeveloperMemberRole[] = ["OWNER", "ADMIN"];
export const PRODUCT_ROLES: readonly DeveloperMemberRole[] = ["OWNER", "ADMIN", "DEVELOPER"];
export const READ_ROLES: readonly DeveloperMemberRole[] = [
  "OWNER",
  "ADMIN",
  "DEVELOPER",
  "SUPPORT",
  "ANALYST",
];

export function canManageSecrets(role: DeveloperMemberRole): boolean {
  return SECRET_ROLES.includes(role);
}

export function canManageProducts(role: DeveloperMemberRole): boolean {
  return PRODUCT_ROLES.includes(role);
}

export function canManageMembers(role: DeveloperMemberRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManagePayouts(role: DeveloperMemberRole): boolean {
  return role === "OWNER";
}

export function canDestroyProfile(role: DeveloperMemberRole): boolean {
  return role === "OWNER";
}

export function canReadPortal(role: DeveloperMemberRole): boolean {
  return READ_ROLES.includes(role);
}
