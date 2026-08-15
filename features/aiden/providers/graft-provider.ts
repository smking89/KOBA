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
 * Graft: custom monument/prop/texture generation. Same split as Vest —
 * TEXTURE is a 2D image (Replicate), PROP/ANIMATION are 3D (Tripo).
 * PROP is a static prop (text-to-3D only); ANIMATION chains an auto-rig
 * pass so the result is actually posable/animatable, not just a static
 * mesh under an "Animation" label.
 */
export const graftProvider: AidenProvider = {
  product: "GRAFT",
  isConfigured(): boolean {
    return isReplicateConfigured() || isTripoConfigured();
  },
  async generate(input: AidenGenerationInput): Promise<AidenGenerationResult> {
    if (input.assetType === "TEXTURE") {
      if (!isReplicateConfigured()) {
        throw new AidenProviderNotConfiguredError("GRAFT", IMAGE_ENV_VAR);
      }
      return generateImage({ prompt: input.prompt, model: "SDXL_IMAGE" });
    }
    // PROP: static 3D asset. ANIMATION: 3D asset + auto-rig.
    return generate3D({ prompt: input.prompt, withAutoRig: input.assetType === "ANIMATION" });
  },
};
