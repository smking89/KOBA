/**
 * Per-model Coin cost table (confirmed pricing). Unlike
 * features/aiden/lib/cost.ts#usdToCoins (which converts a variable,
 * post-hoc-reported USD cost into Coins for an unlisted/metered
 * provider), every model below has a FIXED, KNOWN Coin cost per
 * generation — coinCostPreview and coinCostActual are always equal for
 * these, there's no estimate-vs-actual gap to reconcile.
 *
 * Only CLAUDE_TEXT is wired to a real provider today
 * (features/aiden/providers/claude-provider.ts). The rest document the
 * confirmed pricing for when each vendor is actually integrated — adding
 * one is "write a provider file following the existing fail-closed
 * pattern," not a pricing decision, that part's already settled here.
 */
export const MODEL_COIN_COST = {
  // Vest — image/skin generation
  SDXL_IMAGE: 1,
  KANDINSKY_IMAGE: 1,
  // Graft — 3D asset generation (vendor: Tripo AI)
  TRIPO_TEXT_TO_3D: 1,
  TRIPO_IMAGE_TO_3D: 3,
  TRIPO_AUTO_RIG: 3,
  // Video generation (product preview/showcase clips)
  HUNYUAN_FAST_VIDEO: 1,
  HUNYUAN_STANDARD_VIDEO: 1,
  LUMA_540P_VIDEO: 2,
  LUMA_1080P_VIDEO: 12,
  /** Per second of output. */
  FLUX_HD_VIDEO_PER_SECOND: 2,
  /** Per second of output. */
  FLUX_FHD_VIDEO_PER_SECOND: 3,
  // Text — product descriptions and other copy (vendor: Claude API,
  // wired for real — see claude-provider.ts). Not part of the original
  // confirmed price list; set at the cheapest tier pending confirmation.
  CLAUDE_TEXT: 1,
} as const;

export type ModelId = keyof typeof MODEL_COIN_COST;

export function coinCostForModel(model: ModelId, seconds?: number): number {
  if (model === "FLUX_HD_VIDEO_PER_SECOND" || model === "FLUX_FHD_VIDEO_PER_SECOND") {
    if (!seconds || seconds <= 0) {
      throw new RangeError(`${model} requires a positive seconds value.`);
    }
    return MODEL_COIN_COST[model] * seconds;
  }
  return MODEL_COIN_COST[model];
}
