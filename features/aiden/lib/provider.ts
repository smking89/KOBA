import { createHash } from "node:crypto";
import { aidenModelName, aidenModelVersion, aidenProviderId } from "@/features/aiden/lib/pricing";

export type AidenProviderUsage = {
  units: bigint;
  costCoins: bigint;
};

export type AidenProviderResult = {
  providerRequestId: string;
  status: "succeeded" | "failed";
  mime?: string;
  bytes?: Buffer;
  remoteUrl?: string;
  width?: number;
  height?: number;
  usage: AidenProviderUsage;
  model: string;
  modelVersion: string;
  error?: string;
};

export type AidenProviderSubmitInput = {
  publicRef: string;
  prompt: string;
  width: number;
  height: number;
  idempotencyKey: string;
};

export type AidenGenerationProvider = {
  id: string;
  submit(input: AidenProviderSubmitInput): Promise<{ providerRequestId: string }>;
  retrieve(providerRequestId: string): Promise<AidenProviderResult>;
};

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export class MockAidenProvider implements AidenGenerationProvider {
  readonly id = "mock";

  async submit(input: AidenProviderSubmitInput): Promise<{ providerRequestId: string }> {
    const digest = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16);
    return { providerRequestId: `mock_${digest}` };
  }

  async retrieve(providerRequestId: string): Promise<AidenProviderResult> {
    return {
      providerRequestId,
      status: "succeeded",
      mime: "image/png",
      bytes: PNG_1X1,
      width: 1,
      height: 1,
      usage: { units: 1n, costCoins: 40n },
      model: aidenModelName(),
      modelVersion: aidenModelVersion(),
    };
  }
}

/**
 * Provider callbacks are rejected unless a webhook secret is configured and verified.
 * The mock provider never sends callbacks; workers poll `retrieve` instead.
 */
export function verifyAidenProviderCallback(headers: Headers, rawBody: string): boolean {
  void headers;
  void rawBody;
  const secret = process.env.AIDEN_PROVIDER_WEBHOOK_SECRET?.trim();
  if (!secret || secret.includes("replace")) {
    return false;
  }
  return false;
}

export function getAidenProvider(): AidenGenerationProvider {
  if (!isRealAidenProviderConfigured()) {
    return new MockAidenProvider();
  }
  // No production adapter is wired in this phase. Keep the mock so the
  // feature stays operational without calling a paid vendor.
  return new MockAidenProvider();
}

export function isRealAidenProviderConfigured(): boolean {
  const key = process.env.AIDEN_PROVIDER_API_KEY?.trim();
  return Boolean(key && !key.includes("replace") && aidenProviderId() !== "mock");
}
