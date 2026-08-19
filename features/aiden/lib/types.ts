export const AIDEN_ASSET_TYPES = [
  "CONCEPT_IMAGE",
  "SKIN",
  "TEXTURE",
  "PROP",
  "ANIMATION",
  "TERRAIN",
  "MAP",
] as const;

export type AidenAssetType = (typeof AIDEN_ASSET_TYPES)[number];

/// SKIN added 2026-08-18 — real generation (Tripo mesh+rig+diffuse,
/// Kandinsky PBR maps, Blender assembly) is wired end to end, see
/// features/aiden/lib/provider.ts#RealAidenProvider and
/// completeFromProvider's mesh branch in aiden.service.ts. The
/// remaining types (TEXTURE/PROP/ANIMATION/TERRAIN/MAP) stay inactive
/// — TERRA (TERRAIN/MAP) has no real provider at all yet
/// (features/aiden/providers/terra-provider.ts is still a stub).
export const AIDEN_ACTIVE_GENERATION_TYPES = ["CONCEPT_IMAGE", "SKIN"] as const;
export type AidenActiveGenerationType = (typeof AIDEN_ACTIVE_GENERATION_TYPES)[number];

export const AIDEN_TECHNICAL_STATUSES = [
  "CONCEPT",
  "CONCEPT_ONLY",
  "PREVIEW",
  "REQUIRES_CONVERSION",
  "VALIDATION_FAILED",
  "APPROVED_FOR_MARKETPLACE",
  "GAME_READY",
] as const;

export type AidenTechnicalStatus = (typeof AIDEN_TECHNICAL_STATUSES)[number];

export const AIDEN_JOB_STATES = [
  "DRAFT",
  "QUEUED",
  "PROCESSING",
  "MODERATING",
  "SUCCEEDED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type AidenJobState = (typeof AIDEN_JOB_STATES)[number];

export const AIDEN_MODERATION_STATES = [
  "PRIVATE",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
] as const;

export type AidenModerationState = (typeof AIDEN_MODERATION_STATES)[number];

export type AidenJobView = {
  publicRef: string;
  prompt: string;
  game: string;
  platform: string;
  assetType: AidenAssetType;
  state: AidenJobState;
  coinCostPreview: number;
  estimatedCostCoins: string;
  actualCostCoins: string | null;
  coinCostActual: number | null;
  provider: string;
  model: string;
  modelVersion: string;
  readiness: AidenTechnicalStatus;
  failureReason: string | null;
  createdAt: string;
  assetPublicRef: string | null;
};

export type AidenAssetView = {
  publicRef: string;
  title: string;
  assetType: AidenAssetType;
  technicalStatus: AidenTechnicalStatus;
  moderation: AidenModerationState;
  game: string;
  previewLabel: string;
  provider: string | null;
  model: string | null;
  createdAt?: string;
  assetUrl: string | null;
  /** Slug of the Product this asset was published as, once published.
   * Null means never published — see publishAssetToMarketplace. */
  publishedProductSlug: string | null;
};

export function aidenAssetTypeLabel(type: AidenAssetType): string {
  switch (type) {
    case "CONCEPT_IMAGE":
      return "Concept image";
    case "SKIN":
      return "Skin";
    case "TEXTURE":
      return "Texture";
    case "PROP":
      return "Prop";
    case "ANIMATION":
      return "Animation";
    case "TERRAIN":
      return "Terrain asset";
    case "MAP":
      return "Map asset";
    default:
      return type;
  }
}

export function aidenTechnicalLabel(status: AidenTechnicalStatus): string {
  switch (status) {
    case "CONCEPT":
      return "Concept";
    case "CONCEPT_ONLY":
      return "Concept only";
    case "PREVIEW":
      return "Preview";
    case "REQUIRES_CONVERSION":
      return "Requires conversion";
    case "VALIDATION_FAILED":
      return "Validation failed";
    case "APPROVED_FOR_MARKETPLACE":
      return "Approved for marketplace review";
    case "GAME_READY":
      return "Game-ready";
    default:
      return status;
  }
}

export function aidenJobLabel(state: AidenJobState): string {
  switch (state) {
    case "DRAFT":
      return "Draft";
    case "QUEUED":
      return "Queued";
    case "PROCESSING":
      return "Processing";
    case "MODERATING":
      return "Moderating";
    case "SUCCEEDED":
    case "COMPLETED":
      return state === "COMPLETED" ? "Completed" : "Succeeded";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return state;
  }
}

export function isTerminalAidenState(state: AidenJobState): boolean {
  return (
    state === "SUCCEEDED" || state === "COMPLETED" || state === "FAILED" || state === "CANCELLED"
  );
}

export function isSuccessfulAidenState(state: AidenJobState): boolean {
  return state === "SUCCEEDED" || state === "COMPLETED";
}

/** UI copy: AI output is not automatically a functional game asset. */
export const AIDEN_DISCLAIMER =
  "Aiden outputs are creative drafts. A concept or preview is not automatically a functional, game-ready asset.";
