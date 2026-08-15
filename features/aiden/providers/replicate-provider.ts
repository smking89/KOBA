import { isEnvConfigured } from "@/features/aiden/providers/env-gate";
import type { ModelId } from "@/features/aiden/lib/model-costs";
import type { AidenGenerationResult } from "@/features/aiden/providers/types";

const ENV_VAR = "REPLICATE_API_TOKEN";
const API_BASE = "https://api.replicate.com/v1";

/** Replicate's own published hardware rate (replicate.com/pricing,
 * verified 2026-08-15) — SDXL/Kandinsky both run on Nvidia L40S. Unlike
 * Tripo's fixed per-task-type credit price, Replicate bills metered
 * compute-seconds, so actualCostUsd below is computed from the real
 * predict_time this specific run took × this real rate — not a flat
 * guess, and not borrowed from KOBA's own coin price (which bundles in
 * margin, not raw cost — see coin-packages.ts). SDXL's own model page
 * estimates ~$0.0036/run (~4s typical); FALLBACK_COST_USD matches that
 * for the rare case metrics.predict_time is missing from the response. */
const L40S_RATE_USD_PER_SECOND = 0.000975;
const FALLBACK_COST_USD = 0.0036;

/** Official-model slugs — the `{owner}/{model}` form needs no pinned
 * version hash (Replicate resolves it to that model's latest version),
 * so this doesn't go stale the way a hardcoded version id would. */
const REPLICATE_MODEL_SLUG = {
  SDXL_IMAGE: "stability-ai/sdxl",
  KANDINSKY_IMAGE: "ai-forever/kandinsky-2.2",
} as const;

export class ReplicateNotConfiguredError extends Error {
  constructor() {
    super(`Replicate has no configured API token (set ${ENV_VAR} to enable).`);
    this.name = "ReplicateNotConfiguredError";
  }
}

export class ReplicateGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplicateGenerationError";
  }
}

export function isReplicateConfigured(): boolean {
  return isEnvConfigured(ENV_VAR);
}

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: string | null;
  metrics?: { predict_time?: number };
  urls: { get: string };
};

/**
 * Runs an official Replicate model to completion. Uses `Prefer: wait=55`
 * to block for up to 55s on Replicate's side rather than hand-rolling a
 * poll loop — SDXL/Kandinsky image generation typically finishes well
 * inside that window. If Replicate itself times out server-side first,
 * this falls back to a short client-side poll of the same prediction
 * before giving up, so a slow-but-real generation isn't thrown away.
 *
 * Cost note: Replicate's prediction response has no per-request USD
 * figure (only compute-seconds via metrics.predict_time, which needs a
 * known hardware-SKU $/second rate to convert — not returned here). Real
 * actualCostUsd is therefore the fixed coinCostForModel() rate
 * (features/aiden/lib/model-costs.ts), same as every other model in that
 * table — not something read back from Replicate's response.
 */
async function runOfficialModel(
  modelSlug: string,
  input: Record<string, unknown>,
): Promise<ReplicatePrediction> {
  const token = process.env[ENV_VAR];
  const response = await fetch(`${API_BASE}/models/${modelSlug}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=55",
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ReplicateGenerationError(`Replicate request failed (${response.status}): ${body}`);
  }

  let prediction = (await response.json()) as ReplicatePrediction;

  // Prefer: wait can itself time out server-side and return a
  // still-processing prediction — poll the same id a bit longer before
  // giving up (bounded: ~30s more, 2s interval).
  for (let attempt = 0; attempt < 15 && prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollResponse = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollResponse.ok) {
      throw new ReplicateGenerationError(`Replicate poll failed (${pollResponse.status}).`);
    }
    prediction = (await pollResponse.json()) as ReplicatePrediction;
  }

  if (prediction.status !== "succeeded") {
    throw new ReplicateGenerationError(
      prediction.error ? `Replicate generation failed: ${prediction.error}` : "Replicate generation timed out.",
    );
  }

  return prediction;
}

function firstOutputUrl(output: unknown): string | null {
  if (typeof output === "string") {
    return output;
  }
  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0] as string;
  }
  return null;
}

export async function generateImage(input: {
  prompt: string;
  model?: "SDXL_IMAGE" | "KANDINSKY_IMAGE";
}): Promise<AidenGenerationResult> {
  if (!isReplicateConfigured()) {
    throw new ReplicateNotConfiguredError();
  }

  const modelId: ModelId = input.model ?? "SDXL_IMAGE";
  const modelSlug = REPLICATE_MODEL_SLUG[modelId === "KANDINSKY_IMAGE" ? "KANDINSKY_IMAGE" : "SDXL_IMAGE"];
  const prediction = await runOfficialModel(modelSlug, { prompt: input.prompt });

  const assetUrl = firstOutputUrl(prediction.output);
  if (!assetUrl) {
    throw new ReplicateGenerationError("Replicate succeeded but returned no output URL.");
  }

  const predictTimeSeconds = prediction.metrics?.predict_time ?? null;
  const actualCostUsd =
    predictTimeSeconds !== null
      ? predictTimeSeconds * L40S_RATE_USD_PER_SECOND
      : FALLBACK_COST_USD;

  return {
    assetUrl,
    previewLabel: "Generated image",
    actualCostUsd,
    usage: {
      provider: "replicate",
      model: modelSlug,
      predictionId: prediction.id,
      predictTimeSeconds,
    },
  };
}
