/** Platform-wide blacklist/ban management is Superadmin-only (client,
 * 2026-08-18: "we need a blacklist function both for superadmin role,
 * and business accounts, both work similar") — deliberately stricter
 * than the rest of staff moderation (Admin/Moderator can't issue a
 * platform ban), same pattern as canManagePlatformFunctions. */
export function canManagePlatformBlacklist(actorAccountTypes: readonly string[]): boolean {
  return actorAccountTypes.includes("SUPERADMIN");
}
