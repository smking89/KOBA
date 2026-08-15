import type { AidenAssetType } from "@/features/aiden/lib/types";

/** Pure, client-safe cost table — the single source of truth for both the
 * server (features/aiden/services/aiden.service.ts's reservation amount)
 * and the client (cost preview shown before submitting). */
const ASSET_COST: Record<AidenAssetType, number> = {
  CONCEPT_IMAGE: 40,
  SKIN: 40,
  TEXTURE: 50,
  PROP: 60,
  ANIMATION: 80,
  TERRAIN: 120,
  MAP: 120,
};

export function coinCostForAssetType(assetType: AidenAssetType): number {
  return ASSET_COST[assetType] ?? 40;
}
