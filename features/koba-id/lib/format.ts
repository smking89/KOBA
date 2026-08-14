export type KobaAccountType =
  "PLAYER" | "BUSINESS" | "INFLUENCER" | "SUPERADMIN" | "ADMIN" | "MODERATOR";

export const KOBA_ID_PATTERN = /^KOBA-(PL|BZ|IN|SA|AD|MD)-[0-9A-F]{4}$/;

export const PUBLIC_ACCOUNT_TYPES = ["PLAYER", "BUSINESS", "INFLUENCER"] as const;
export const STAFF_ACCOUNT_TYPES = ["SUPERADMIN", "ADMIN", "MODERATOR"] as const;

export type PublicAccountType = (typeof PUBLIC_ACCOUNT_TYPES)[number];
export type StaffAccountType = (typeof STAFF_ACCOUNT_TYPES)[number];

export const ROLE_PREFIX: Record<KobaAccountType, string> = {
  PLAYER: "PL",
  BUSINESS: "BZ",
  INFLUENCER: "IN",
  SUPERADMIN: "SA",
  ADMIN: "AD",
  MODERATOR: "MD",
};

export const PREFIX_ROLE: Record<string, KobaAccountType> = {
  PL: "PLAYER",
  BZ: "BUSINESS",
  IN: "INFLUENCER",
  SA: "SUPERADMIN",
  AD: "ADMIN",
  MD: "MODERATOR",
};

export const ACCOUNT_TYPE_LABEL: Record<KobaAccountType, string> = {
  PLAYER: "Player",
  BUSINESS: "Business",
  INFLUENCER: "Influencer",
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
};

export function isPublicAccountType(value: string): value is PublicAccountType {
  return (PUBLIC_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function isStaffAccountType(value: string): value is StaffAccountType {
  return (STAFF_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function isValidKobaId(code: string): boolean {
  return KOBA_ID_PATTERN.test(code);
}

export type RandomBytesFn = (size: number) => Uint8Array;

/** Builds `KOBA-PL-9F42` style codes. Suffix is 2 cryptographically random bytes as hex. */
export function generateKobaIdCode(
  accountType: KobaAccountType,
  randomBytes: RandomBytesFn,
): string {
  const prefix = ROLE_PREFIX[accountType];
  const bytes = randomBytes(2);
  const suffix = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `KOBA-${prefix}-${suffix}`;
}

export function dashboardPathFor(accountType: KobaAccountType | null | undefined): string {
  switch (accountType) {
    case "BUSINESS":
      return "/business";
    case "INFLUENCER":
      return "/influencer";
    case "SUPERADMIN":
    case "ADMIN":
    case "MODERATOR":
      return "/admin";
    default:
      return "/dashboard";
  }
}
