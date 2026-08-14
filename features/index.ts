/** Feature scaffolds — business logic lands in later phases. */
export const FEATURE_SCAFFOLDS = [
  "auth",
  "koba-id",
  "accounts",
  "marketplace",
  "shops",
  "auctions",
  "groups",
  "lfg",
  "social",
  "messages",
  "trade",
  "servers",
  "plus",
  "aiden",
  "wallet",
  "influencers",
  "developer-portal",
  "admin",
  "navigation",
  "media",
  "payments",
] as const;

export type FeatureScaffold = (typeof FEATURE_SCAFFOLDS)[number];
