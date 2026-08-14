import type { KobaAccountType, StaffAccountType } from "@/features/koba-id/lib/format";

/** Superadmin may issue SA/AD/MD. Admin may issue MD only. Players cannot issue staff. */
export function canIssueStaffRole(
  actorTypes: readonly KobaAccountType[],
  target: StaffAccountType,
): boolean {
  const isSuperadmin = actorTypes.includes("SUPERADMIN");
  const isAdmin = actorTypes.includes("ADMIN");

  if (target === "SUPERADMIN" || target === "ADMIN") {
    return isSuperadmin;
  }

  return isSuperadmin || isAdmin;
}
