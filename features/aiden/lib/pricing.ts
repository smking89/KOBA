import { parseCoinAmount, type CoinAmount } from "@/features/wallet/lib/amounts";
import { AIDEN_ACTIVE_GENERATION_TYPES, type AidenAssetType } from "@/features/aiden/lib/types";

export type AidenEstimateInput = {
  assetType: AidenAssetType;
  width?: number | undefined;
  height?: number | undefined;
  quality?: "standard" | "hd" | undefined;
  count?: number | undefined;
};

export type AidenCostEstimate = {
  assetType: AidenAssetType;
  estimatedCostCoins: CoinAmount;
  estimatedCostCoinsText: string;
  currency: "KOBA_COIN";
  provider: string;
  model: string;
  active: boolean;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function aidenProviderId(): string {
  return (process.env.AIDEN_PROVIDER ?? "mock").trim() || "mock";
}

export function aidenModelName(): string {
  return (process.env.AIDEN_MODEL ?? "aiden-mock-concept").trim() || "aiden-mock-concept";
}

export function aidenModelVersion(): string {
  return (process.env.AIDEN_MODEL_VERSION ?? "1").trim() || "1";
}

export function isAidenGenerationTypeActive(assetType: AidenAssetType): boolean {
  return (AIDEN_ACTIVE_GENERATION_TYPES as readonly string[]).includes(assetType);
}

export function estimateAidenCost(input: AidenEstimateInput): AidenCostEstimate {
  const count = input.count ?? 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 4) {
    throw new Error("INVALID_COUNT");
  }
  const active = isAidenGenerationTypeActive(input.assetType);
  let unit = envInt("AIDEN_PRICE_CONCEPT_IMAGE", 40);
  if (input.assetType !== "CONCEPT_IMAGE") {
    unit = envInt(`AIDEN_PRICE_${input.assetType}`, unit);
  }
  if (input.quality === "hd") {
    unit += envInt("AIDEN_PRICE_CONCEPT_IMAGE_HD_SURCHARGE", 20);
  }
  const pixels = (input.width ?? 512) * (input.height ?? 512);
  if (pixels > 1024 * 1024) {
    unit += envInt("AIDEN_PRICE_LARGE_SURCHARGE", 15);
  }
  const total = parseCoinAmount(unit * count);
  return {
    assetType: input.assetType,
    estimatedCostCoins: total,
    estimatedCostCoinsText: total.toString(),
    currency: "KOBA_COIN",
    provider: aidenProviderId(),
    model: aidenModelName(),
    active,
  };
}

export function allowAidenCostOverrun(): boolean {
  return process.env.AIDEN_ALLOW_COST_OVERRUN === "true";
}
