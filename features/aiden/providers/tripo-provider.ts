import { isEnvConfigured } from "@/features/aiden/providers/env-gate";
import { coinCostForModel } from "@/features/aiden/lib/model-costs";
import { MODEL_COST_CENTS_PER_COIN } from "@/features/wallet/lib/coin-packages";
import type { AidenGenerationResult } from "@/features/aiden/providers/types";

const ENV_VAR = "TRIPO_API_KEY";
const API_BASE = "https://api.tripo3d.ai/v2/openapi";

export class TripoNotConfiguredError extends Error {
  constructor() {
    super(`Tripo has no configured API key (set ${ENV_VAR} to enable).`);
    this.name = "TripoNotConfiguredError";
  }
}

export class TripoGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripoGenerationError";
  }
}

export function isTripoConfigured(): boolean {
  return isEnvConfigured(ENV_VAR);
}

type TripoTaskResponse = {
  code: number;
  data: {
    task_id: string;
    type: string;
    status: "queued" | "running" | "success" | "failed" | "banned" | "expired";
    progress?: number;
    output?: { model_url?: string; rendered_image_url?: string };
  };
};

async function createTask(body: Record<string, unknown>): Promise<string> {
  const token = process.env[ENV_VAR];
  const response = await fetch(`${API_BASE}/task`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new TripoGenerationError(`Tripo task creation failed (${response.status}): ${text}`);
  }
  const payload = (await response.json()) as TripoTaskResponse;
  if (payload.code !== 0 || !payload.data?.task_id) {
    throw new TripoGenerationError("Tripo task creation returned no task id.");
  }
  return payload.data.task_id;
}

/** Tripo's own docs describe generation as taking roughly 10-120 seconds.
 * Polled here synchronously (matching this codebase's existing
 * one-request-per-generation-step architecture — see aiden.service.ts's
 * runGeneration doc comment) with a bounded ~150s ceiling; a
 * consistently-slower model would need an async job+webhook redesign,
 * not a bigger timeout here. */
async function pollTask(taskId: string): Promise<TripoTaskResponse["data"]> {
  const token = process.env[ENV_VAR];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${API_BASE}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new TripoGenerationError(`Tripo task poll failed (${response.status}).`);
    }
    const payload = (await response.json()) as TripoTaskResponse;
    const data = payload.data;
    if (data.status === "success") {
      return data;
    }
    if (data.status === "failed" || data.status === "banned" || data.status === "expired") {
      throw new TripoGenerationError(`Tripo task ended with status "${data.status}".`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new TripoGenerationError("Tripo task timed out waiting for completion.");
}

/**
 * Generates a 3D asset from a text prompt, optionally chaining an
 * auto-rig pass on top — the "fully rigged, animated, game-ready" combo
 * ROADMAP.md originally recommended Tripo for.
 *
 * NOTE on confidence: the create/poll task shape below (POST /v2/openapi/
 * task, GET /v2/openapi/task/{id}, {code, data: {task_id, status,
 * output}}) is confirmed against Tripo's published API examples. The
 * auto-rig chaining call — task type "animate_rig" taking an
 * `original_model_task_id` field — is inferred from Tripo's documented
 * task-type list (their docs site is a JS app this environment couldn't
 * fully render), not confirmed against a live example. Verify that one
 * field name against Tripo's current docs (or a test call) before relying
 * on it in production; if it's wrong, generation will fail loudly (this
 * provider throws TripoGenerationError, it does not silently no-op), not
 * silently misbehave.
 */
export async function generate3D(input: {
  prompt: string;
  withAutoRig: boolean;
}): Promise<AidenGenerationResult> {
  if (!isTripoConfigured()) {
    throw new TripoNotConfiguredError();
  }

  const modelTaskId = await createTask({ type: "text_to_model", prompt: input.prompt });
  const modelResult = await pollTask(modelTaskId);

  if (!input.withAutoRig) {
    if (!modelResult.output?.model_url) {
      throw new TripoGenerationError("Tripo succeeded but returned no model URL.");
    }
    return {
      assetUrl: modelResult.output.model_url,
      previewLabel: "Generated 3D model",
      actualCostUsd: (coinCostForModel("TRIPO_TEXT_TO_3D") * MODEL_COST_CENTS_PER_COIN) / 100,
      usage: { provider: "tripo", taskId: modelTaskId, chained: false },
    };
  }

  const rigTaskId = await createTask({
    type: "animate_rig",
    original_model_task_id: modelTaskId,
  });
  const rigResult = await pollTask(rigTaskId);
  const assetUrl = rigResult.output?.model_url ?? modelResult.output?.model_url;
  if (!assetUrl) {
    throw new TripoGenerationError("Tripo auto-rig succeeded but returned no model URL.");
  }

  return {
    assetUrl,
    previewLabel: "Generated + rigged 3D model",
    actualCostUsd:
      (coinCostForModel("TRIPO_TEXT_TO_3D") * MODEL_COST_CENTS_PER_COIN) / 100 +
      (coinCostForModel("TRIPO_AUTO_RIG") * MODEL_COST_CENTS_PER_COIN) / 100,
    usage: { provider: "tripo", taskId: modelTaskId, rigTaskId, chained: true },
  };
}
