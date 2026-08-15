import { generateImage, isReplicateConfigured } from "@/features/aiden/providers/replicate-provider";
import { generate3D, isTripoConfigured } from "@/features/aiden/providers/tripo-provider";
import {
  AidenProviderNotConfiguredError,
  type AidenGenerationInput,
  type AidenGenerationResult,
  type AidenProvider,
} from "@/features/aiden/providers/types";

const IMAGE_ENV_VAR = "REPLICATE_API_TOKEN";

/**
 * Vest: skin generation. Per client direction (2026-08-15), this isn't
 * one vendor — CONCEPT_IMAGE is a 2D image (Replicate: SDXL/Kandinsky),
 * SKIN is a rigged 3D asset (Tripo: text-to-3D + auto-rig, the original
 * "fully rigged, animated, game-ready" recommendation). isConfigured()
 * is permissive (true if either backend is ready) since which one a
 * given job actually needs depends on its assetType, checked in
 * generate() — the precise per-vendor NotConfigured error still surfaces
 * from there if the specific one needed is missing.
 */
export const vestProvider: AidenProvider = {
  product: "VEST",
  isConfigured(): boolean {
    return isReplicateConfigured() || isTripoConfigured();
  },
  async generate(input: AidenGenerationInput): Promise<AidenGenerationResult> {
    if (input.assetType === "CONCEPT_IMAGE") {
      if (!isReplicateConfigured()) {
        throw new AidenProviderNotConfiguredError("VEST", IMAGE_ENV_VAR);
      }
      return generateImage({ prompt: input.prompt, model: "SDXL_IMAGE" });
    }
    // SKIN — fully rigged, game-ready 3D asset.
    return generate3D({ prompt: input.prompt, withAutoRig: true });
  },
};
