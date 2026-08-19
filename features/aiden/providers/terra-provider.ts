import {
  generateImage,
  isReplicateConfigured,
} from "@/features/aiden/providers/replicate-provider";
import {
  AidenProviderNotConfiguredError,
  type AidenGenerationInput,
  type AidenGenerationResult,
  type AidenProvider,
} from "@/features/aiden/providers/types";

const IMAGE_ENV_VAR = "REPLICATE_API_TOKEN";

/** Deliberately technical, not scenic — a heightmap needs to encode
 * actual elevation data as image luminance, not look like concept
 * art. "16-bit grayscale" is aspirational language on the client's
 * side (SDXL's own output is 8-bit like any other Replicate image
 * model) — this asks for the closest approximation SDXL can produce:
 * a flat grayscale elevation map, not a lit, textured landscape
 * render. */
const HEIGHTMAP_PROMPT_SUFFIX =
  "grayscale terrain heightmap texture, top-down orthographic view, elevation encoded as brightness (white = high, black = low), no color, no lighting or shadows, no vegetation or objects, technical texture map not concept art";

/**
 * Client, 2026-08-18 (KOBA Aiden pipeline spec, Terra): "SDXL (The
 * Topography & Heightmap Driver): Generates precise ... raw terrain
 * heightmaps, alpha splat maps, and biome masks."
 *
 * TERRAIN (concept tier, active) — one SDXL heightmap image, same
 * single-call shape as Vest's CONCEPT_IMAGE / Graft's TEXTURE.
 *
 * MAP (the full "playable .map file" tier) is NOT implemented here.
 * That pipeline is genuinely different in kind, not just bigger: it
 * needs Claude 3.5 Sonnet's structured terrain-logic output (object
 * placement vectors, biome data, serialization) combined with
 * multiple SDXL images (heightmap + splat map + biome mask) into one
 * packaged deliverable — Claude's output is plain text, not a
 * downloadable URL, so it doesn't fit this file's single generate()
 * → assetUrl contract the way Tripo/Replicate's real, hosted outputs
 * do (see how features/aiden/lib/provider.ts#RealAidenProvider layers
 * Blender assembly on top of a real Tripo URL for the SKIN
 * precedent — MAP has no equivalent single URL to layer onto).
 * MAP stays out of AIDEN_ACTIVE_GENERATION_TYPES until that's built.
 */
export const terraProvider: AidenProvider = {
  product: "TERRA",
  isConfigured(): boolean {
    return isReplicateConfigured();
  },
  async generate(input: AidenGenerationInput): Promise<AidenGenerationResult> {
    if (input.assetType === "MAP") {
      throw new Error(
        "MAP generation (full compiled map + terrain logic) is not implemented yet — only TERRAIN (a heightmap concept preview) is wired.",
      );
    }
    if (!isReplicateConfigured()) {
      throw new AidenProviderNotConfiguredError("TERRA", IMAGE_ENV_VAR);
    }
    return generateImage({
      prompt: `${input.prompt}, ${HEIGHTMAP_PROMPT_SUFFIX}`,
      model: "SDXL_IMAGE",
    });
  },
};
