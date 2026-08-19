import { generateImage } from "@/features/aiden/providers/replicate-provider";

/**
 * Client, 2026-08-18 (KOBA Aiden pipeline spec, VEST/skin completion):
 * "Kandinsky (The PBR Materials Engine): Generates the secondary
 * material texture maps required for real-time game engine lighting:
 * Normal Maps... Specular/Metallic Maps... Emission Maps." Tripo
 * already supplies the mesh + rig + baked diffuse (`texture: true` on
 * its text-to-3D task, see tripo-provider.ts) — this is the remaining
 * three-map set that a bare Tripo skin doesn't have, generated as
 * three separate Kandinsky image calls (Replicate already has
 * KANDINSKY_IMAGE wired, see replicate-provider.ts).
 */
export type PbrMapSet = {
  normalMapUrl: string;
  specularMapUrl: string;
  emissionMapUrl: string;
  totalCostUsd: number;
  usage: Record<string, unknown>[];
};

/** Deliberately explicit, separate prompt suffixes per map type rather
 * than one shared "PBR texture" suffix — each map encodes a different
 * kind of data (surface normals vs. grayscale roughness vs. a
 * black-background glow mask) and a single vague prompt tends to
 * produce a generically "shiny" image instead of the specific
 * per-channel data each map actually needs to be useful in a real
 * material graph. */
const MAP_PROMPT_SUFFIX = {
  normal:
    "tangent-space normal map texture, flat blue-purple base color, seamless tileable, no baked lighting or shadows, technical texture map not concept art",
  specular:
    "grayscale specular roughness texture map, seamless tileable, no color information, technical texture map not concept art",
  emission:
    "emission mask texture, solid black background with only glowing elements visible in color, seamless tileable, technical texture map not concept art",
} as const;

/** Split out from generatePbrMapSet so the exact prompt text sent to
 * Kandinsky for each map is unit-testable without a network call. */
export function buildPbrMapPrompts(basePrompt: string): {
  normal: string;
  specular: string;
  emission: string;
} {
  return {
    normal: `${basePrompt}, ${MAP_PROMPT_SUFFIX.normal}`,
    specular: `${basePrompt}, ${MAP_PROMPT_SUFFIX.specular}`,
    emission: `${basePrompt}, ${MAP_PROMPT_SUFFIX.emission}`,
  };
}

export async function generatePbrMapSet(basePrompt: string): Promise<PbrMapSet> {
  const prompts = buildPbrMapPrompts(basePrompt);
  const [normal, specular, emission] = await Promise.all([
    generateImage({ prompt: prompts.normal, model: "KANDINSKY_IMAGE" }),
    generateImage({ prompt: prompts.specular, model: "KANDINSKY_IMAGE" }),
    generateImage({ prompt: prompts.emission, model: "KANDINSKY_IMAGE" }),
  ]);
  return {
    normalMapUrl: normal.assetUrl,
    specularMapUrl: specular.assetUrl,
    emissionMapUrl: emission.assetUrl,
    totalCostUsd: normal.actualCostUsd + specular.actualCostUsd + emission.actualCostUsd,
    usage: [
      { map: "normal", ...normal.usage },
      { map: "specular", ...specular.usage },
      { map: "emission", ...emission.usage },
    ],
  };
}
