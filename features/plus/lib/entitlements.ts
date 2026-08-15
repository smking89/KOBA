export const ENTITLEMENT_CODES = [
  "PLUS_BADGE",
  "PROFILE_COSMETICS",
  "AIDEN_PRIORITY",
  "EXTRA_SERVER_SLOTS",
  "ENHANCED_SHOP_THEME",
  "HIGHER_UPLOAD_LIMITS",
  "INCREASED_SAVED_ITEMS",
  "LARGER_MEDIA_LIMITS",
  "PROMOTIONAL_MONTHLY_COINS",
] as const;

export type EntitlementCode = (typeof ENTITLEMENT_CODES)[number];

export type EntitlementDefinition = {
  code: EntitlementCode;
  label: string;
  approved: boolean;
  description: string;
};

/**
 * Registry of possible Plus capabilities.
 * Only approved codes may be enabled on a plan.
 */
export const ENTITLEMENT_REGISTRY: readonly EntitlementDefinition[] = [
  {
    code: "PLUS_BADGE",
    label: "KOBA Plus badge",
    approved: true,
    description: "Membership badge on profile and account surfaces.",
  },
  {
    code: "PROFILE_COSMETICS",
    label: "Profile cosmetics",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "AIDEN_PRIORITY",
    label: "Aiden queue priority",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "EXTRA_SERVER_SLOTS",
    label: "Additional server slots",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "ENHANCED_SHOP_THEME",
    label: "Enhanced shop customisation",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "HIGHER_UPLOAD_LIMITS",
    label: "Higher upload limits",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "INCREASED_SAVED_ITEMS",
    label: "Increased saved-item limits",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "LARGER_MEDIA_LIMITS",
    label: "Larger media limits",
    approved: false,
    description: "Placeholder. Not an approved product promise.",
  },
  {
    code: "PROMOTIONAL_MONTHLY_COINS",
    label: "Promotional monthly Coins",
    approved: false,
    description: "Deferred until amount, bucket, expiry, and refund policy are approved.",
  },
];

export function isApprovedEntitlement(code: string): boolean {
  return ENTITLEMENT_REGISTRY.some((row) => row.code === code && row.approved);
}

export function approvedEntitlementCodes(): EntitlementCode[] {
  return ENTITLEMENT_REGISTRY.filter((row) => row.approved).map((row) => row.code);
}
