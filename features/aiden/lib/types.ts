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

export const AIDEN_TECHNICAL_STATUSES = [
  "CONCEPT_ONLY",
  "PREVIEW",
  "REQUIRES_CONVERSION",
  "GAME_READY",
  "VALIDATION_FAILED",
] as const;

export type AidenTechnicalStatus = (typeof AIDEN_TECHNICAL_STATUSES)[number];

export const AIDEN_JOB_STATES = [
  "QUEUED",
  "PROCESSING",
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
  coinCostActual: number | null;
  failureReason: string | null;
  createdAt: string;
};

export type AidenAssetView = {
  publicRef: string;
  title: string;
  assetType: AidenAssetType;
  technicalStatus: AidenTechnicalStatus;
  moderation: AidenModerationState;
  game: string;
  previewLabel: string;
  assetUrl: string | null;
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
    case "CONCEPT_ONLY":
      return "Concept only";
    case "PREVIEW":
      return "Preview";
    case "REQUIRES_CONVERSION":
      return "Requires conversion";
    case "GAME_READY":
      return "Game-ready";
    case "VALIDATION_FAILED":
      return "Validation failed";
    default:
      return status;
  }
}

export function aidenJobLabel(state: AidenJobState): string {
  switch (state) {
    case "QUEUED":
      return "Queued";
    case "PROCESSING":
      return "Processing";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return state;
  }
}

/** UI copy: AI output is not automatically a functional game asset. */
export const AIDEN_DISCLAIMER =
  "Aiden outputs are creative drafts. A concept or preview is not automatically a functional, game-ready asset.";
