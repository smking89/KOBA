import { describe, expect, it } from "vitest";
import { coinCostForAssetType } from "@/features/aiden/lib/cost-preview";
import { coinCostForModel } from "@/features/aiden/lib/model-costs";

describe("coinCostForAssetType", () => {
  it("matches the real Replicate model cost for image asset types", () => {
    expect(coinCostForAssetType("CONCEPT_IMAGE")).toBe(coinCostForModel("SDXL_IMAGE"));
    expect(coinCostForAssetType("TEXTURE")).toBe(coinCostForModel("SDXL_IMAGE"));
  });

  it("matches the real Tripo model cost for 3D asset types", () => {
    expect(coinCostForAssetType("PROP")).toBe(coinCostForModel("TRIPO_TEXT_TO_3D"));
  });

  it("charges the sum of text-to-3D + auto-rig for SKIN and ANIMATION", () => {
    const chained = coinCostForModel("TRIPO_TEXT_TO_3D") + coinCostForModel("TRIPO_AUTO_RIG");
    expect(coinCostForAssetType("SKIN")).toBe(chained);
    expect(coinCostForAssetType("ANIMATION")).toBe(chained);
  });

  it("never returns a preview cost of zero or negative for any real asset type", () => {
    for (const assetType of ["CONCEPT_IMAGE", "SKIN", "TEXTURE", "PROP", "ANIMATION"] as const) {
      expect(coinCostForAssetType(assetType)).toBeGreaterThan(0);
    }
  });
});
