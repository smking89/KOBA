export const DEV_PRODUCT_KINDS = ["APPLICATION", "PLUGIN"] as const;
export type DevProductKind = (typeof DEV_PRODUCT_KINDS)[number];

export const DEV_REVIEW_STATES = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "SECURITY_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVOKED",
] as const;

export type DevReviewState = (typeof DEV_REVIEW_STATES)[number];

export type DevProductView = {
  publicRef: string;
  kind: DevProductKind;
  name: string;
  pricing: "FREE" | "PAID";
  priceLabel: string;
  version: string;
  compatibility: string[];
  scopes: string[];
  reviewState: DevReviewState;
  installs: number;
};

export const MOCK_DEV_PRODUCTS: DevProductView[] = [
  {
    publicRef: "KOBA-DEV-APP0001",
    kind: "APPLICATION",
    name: "Raid Sync Board",
    pricing: "PAID",
    priceLabel: "$4.99",
    version: "1.2.0",
    compatibility: ["Rust", "KOBA Groups"],
    scopes: ["groups.read", "lfg.read"],
    reviewState: "APPROVED",
    installs: 128,
  },
  {
    publicRef: "KOBA-DEV-PLG0001",
    kind: "PLUGIN",
    name: "Wipe Calendar Hook",
    pricing: "FREE",
    priceLabel: "Free",
    version: "0.9.1",
    compatibility: ["Rust"],
    scopes: ["servers.read"],
    reviewState: "SECURITY_REVIEW",
    installs: 0,
  },
  {
    publicRef: "KOBA-DEV-APP0002",
    kind: "APPLICATION",
    name: "Shop Broadcast",
    pricing: "PAID",
    priceLabel: "$9.99",
    version: "0.3.0",
    compatibility: ["KOBA Shops"],
    scopes: ["shops.read", "orders.read"],
    reviewState: "DRAFT",
    installs: 0,
  },
];

export function devReviewLabel(state: DevReviewState): string {
  switch (state) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Submitted";
    case "IN_REVIEW":
      return "In review";
    case "SECURITY_REVIEW":
      return "Security review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "REVOKED":
      return "Revoked";
    default:
      return state;
  }
}
