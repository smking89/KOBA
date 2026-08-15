import type { AidenAssetType } from "@/features/aiden/lib/types";

export const AIDEN_PRODUCTS = ["VEST", "GRAFT", "TERRA"] as const;
export type AidenProduct = (typeof AIDEN_PRODUCTS)[number];

/**
 * Aiden is the umbrella brand; Vest/Graft/Terra are the named generators
 * under it (ROADMAP.md Phase 14). Each is a distinct modality with its own
 * frontier-model provider — this is a pure mapping from the existing,
 * lower-level AidenAssetType enum onto the brand-level product, not a new
 * taxonomy. Deliberately NOT persisted as a schema column: it's a 1:1
 * deterministic function of assetType today, so storing it redundantly
 * would just be a second source of truth to keep in sync. Revisit only if
 * the mapping ever needs to diverge (e.g. an asset type usable by more than
 * one product).
 */
export function productForAssetType(assetType: AidenAssetType): AidenProduct {
  switch (assetType) {
    case "CONCEPT_IMAGE":
    case "SKIN":
      return "VEST";
    case "TEXTURE":
    case "PROP":
    case "ANIMATION":
      return "GRAFT";
    case "TERRAIN":
    case "MAP":
      return "TERRA";
    default:
      throw new Error(`Unmapped AidenAssetType: ${assetType as string}`);
  }
}

export function productLabel(product: AidenProduct): string {
  switch (product) {
    case "VEST":
      return "Vest";
    case "GRAFT":
      return "Graft";
    case "TERRA":
      return "Terra";
    default:
      throw new Error(`Unmapped AidenProduct: ${product as string}`);
  }
}

export type AidenGenerationInput = {
  prompt: string;
  game: string;
  platform: string;
  assetType: AidenAssetType;
};

export type AidenGenerationResult = {
  /** Where the generated output lives (image/model/map file). */
  assetUrl: string;
  previewLabel: string;
  /** Real cost of this generation, in USD, read back from the provider's
   * own usage/billing response — never estimated client-side. */
  actualCostUsd: number;
  /** Raw provider usage payload, kept as-is for audit/reconciliation. */
  usage: Record<string, unknown>;
};

/**
 * One implementation per Aiden product. Mirrors this codebase's existing
 * Stripe pattern (features/payments/lib/stripe.ts's isStripeConfigured):
 * fails closed on missing/placeholder credentials rather than guessing or
 * silently no-op-ing, so a misconfiguration is loud, not a silent stub
 * result mistaken for a real one.
 */
export interface AidenProvider {
  readonly product: AidenProduct;
  isConfigured(): boolean;
  generate(input: AidenGenerationInput): Promise<AidenGenerationResult>;
}

export class AidenProviderNotConfiguredError extends Error {
  constructor(
    readonly product: AidenProduct,
    readonly envVar: string,
  ) {
    super(
      `${productLabel(product)} has no configured generation provider (set ${envVar} to enable).`,
    );
    this.name = "AidenProviderNotConfiguredError";
  }
}
