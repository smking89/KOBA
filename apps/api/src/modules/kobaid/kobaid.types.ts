/**
 * KOBAID roles. PL/BZ/IN are "community" roles — self-registered by a
 * device holder via KobaidService#mint(). SA/AD/MD are "staff" roles —
 * never self-registered, only created through KobaidService#issueStaff(),
 * the admin-issuance path.
 */
export enum KobaIdRole {
  PLAYER = 'PL',
  BUSINESS = 'BZ',
  INFLUENCER = 'IN',
  SUPERADMIN = 'SA',
  ADMIN = 'AD',
  MODERATOR = 'MD',
}

export const COMMUNITY_ROLES: readonly KobaIdRole[] = [
  KobaIdRole.PLAYER,
  KobaIdRole.BUSINESS,
  KobaIdRole.INFLUENCER,
];

export const STAFF_ROLES: readonly KobaIdRole[] = [
  KobaIdRole.SUPERADMIN,
  KobaIdRole.ADMIN,
  KobaIdRole.MODERATOR,
];

export function isCommunityRole(role: KobaIdRole): boolean {
  return (COMMUNITY_ROLES as KobaIdRole[]).includes(role);
}

export function isStaffRole(role: KobaIdRole): boolean {
  return (STAFF_ROLES as KobaIdRole[]).includes(role);
}

/**
 * A minted KOBAID. Immutable once created — there is deliberately no
 * update method anywhere in this module. Corrections are a new issuance,
 * not a mutation (see ROADMAP.md Phase 1).
 */
export interface KobaId {
  /** Internal storage id (uuid), distinct from the KOBAID string itself. */
  readonly id: string;
  readonly role: KobaIdRole;
  /** 4-character code, see kobaid-format.ts for the allowed alphabet. */
  readonly code: string;
  /** Full rendered identifier, e.g. "KOBA-PL-7F3K". */
  readonly fullId: string;
  readonly deviceId: string;
  readonly userId: string;
  /**
   * Optional referral/promo code captured at mint time. Pointer only —
   * the referral/promo system itself is Phase 10 (Influencer System).
   */
  readonly referralCode: string | null;
  /**
   * Placeholder relation to owned cosmetics. Cosmetics themselves are
   * Phase 3 (Marketplace Core) — this field only models the shape of the
   * relation (a list of cosmetic ids) so Phase 3 has somewhere to attach.
   */
  readonly cosmeticOwnershipRefs: readonly string[];
  /**
   * For staff-issued KOBAIDs, the id of the issuing (staff) KobaId. Null
   * for self-registered community KOBAIDs.
   */
  readonly issuedByKobaId: string | null;
  readonly mintedAt: Date;
  /**
   * Whether this KOBAID is the device's currently active role. Defaults to
   * `false` at mint/issuance time — switching (see AccountSwitchService in
   * the accounts module) is what flips this. NOTE: "switching" never
   * changes the KOBAID itself (role/code/fullId/mintedAt stay put — each
   * role's KOBAID is immutable and permanent, per this module's design);
   * it only changes which of a device's KOBAIDs is currently active.
   */
  readonly active: boolean;
}

export interface MintKobaIdParams {
  role: KobaIdRole;
  deviceId: string;
  userId: string;
  referralCode?: string | null;
}

export interface IssueStaffKobaIdParams {
  role: KobaIdRole;
  deviceId: string;
  userId: string;
  /** The KobaId#id of the staff member performing the issuance. */
  issuedByKobaId: string;
}
