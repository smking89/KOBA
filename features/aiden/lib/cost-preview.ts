import type { AidenAssetType } from "@/features/aiden/lib/types";
import { coinCostForModel } from "@/features/aiden/lib/model-costs";

/** Pure, client-safe cost table — the single source of truth for both the
 * server (features/aiden/services/aiden.service.ts's reservation amount)
 * and the client (cost preview shown before submitting).
 *
 * CONCEPT_IMAGE/TEXTURE now reflect the real SDXL_IMAGE cost and
 * SKIN/PROP/ANIMATION the real Tripo cost (features/aiden/lib/
 * model-costs.ts), now that Replicate (image) and Tripo (3D) are wired —
 * see replicate-provider.ts/tripo-provider.ts. SKIN and ANIMATION chain
 * text-to-3D + auto-rig (per the original "fully rigged, animated,
 * game-ready" Tripo recommendation), so their cost is the sum of both
 * steps; PROP is a static prop, text-to-3D only.
 *
 * TERRAIN/MAP have no vendor at all yet (Terra, ROADMAP.md Phase 14 open
 * question 1) — their number here is a placeholder that's never actually
 * captured today: terraProvider fails closed, so any TERRAIN/MAP job's
 * reservation is released on failure before this number matters. */
const ASSET_COST: Record<AidenAssetType, number> = {
  CONCEPT_IMAGE: coinCostForModel("SDXL_IMAGE"),
  TEXTURE: coinCostForModel("SDXL_IMAGE"),
  PROP: coinCostForModel("TRIPO_TEXT_TO_3D"),
  SKIN: coinCostForModel("TRIPO_TEXT_TO_3D") + coinCostForModel("TRIPO_AUTO_RIG"),
  ANIMATION: coinCostForModel("TRIPO_TEXT_TO_3D") + coinCostForModel("TRIPO_AUTO_RIG"),
  TERRAIN: 120,
  MAP: 120,
};

export function coinCostForAssetType(assetType: AidenAssetType): number {
  return ASSET_COST[assetType] ?? 40;
}
