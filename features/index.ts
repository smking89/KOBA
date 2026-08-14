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
  "influencers",
  "developer-portal",
  "admin",
] as const;

export type FeatureScaffold = (typeof FEATURE_SCAFFOLDS)[number];
