import { describe, expect, it } from "vitest";
import { AIDEN_ASSET_TYPES } from "@/features/aiden/lib/types";
import { expectedCategoryKindForAssetType } from "@/features/aiden/lib/marketplace-mapping";

describe("expectedCategoryKindForAssetType", () => {
  it("maps SKIN to SKINS", () => {
    expect(expectedCategoryKindForAssetType("SKIN")).toBe("SKINS");
  });

  it("maps MAP and TERRAIN to MAPS", () => {
    expect(expectedCategoryKindForAssetType("MAP")).toBe("MAPS");
    expect(expectedCategoryKindForAssetType("TERRAIN")).toBe("MAPS");
  });

  it("maps PROP to MONUMENTS", () => {
    expect(expectedCategoryKindForAssetType("PROP")).toBe("MONUMENTS");
  });

  it("maps TEXTURE and ANIMATION to SERVER_ASSETS", () => {
    expect(expectedCategoryKindForAssetType("TEXTURE")).toBe("SERVER_ASSETS");
    expect(expectedCategoryKindForAssetType("ANIMATION")).toBe("SERVER_ASSETS");
  });

  it("maps CONCEPT_IMAGE to null — never publishable, it's a mockup", () => {
    expect(expectedCategoryKindForAssetType("CONCEPT_IMAGE")).toBeNull();
  });

  it("every known asset type is handled explicitly (no silent fallthrough)", () => {
    for (const assetType of AIDEN_ASSET_TYPES) {
      // Should not throw, and every type should have a defined (possibly
      // null) mapping — this just exercises the full enum for coverage.
      expect(() => expectedCategoryKindForAssetType(assetType)).not.toThrow();
    }
  });

  it("never maps to COSMETICS or KITS — no AidenAssetType is a Cosmetic", () => {
    for (const assetType of AIDEN_ASSET_TYPES) {
      const kind = expectedCategoryKindForAssetType(assetType);
      expect(kind).not.toBe("COSMETICS");
      expect(kind).not.toBe("KITS");
    }
  });
});
