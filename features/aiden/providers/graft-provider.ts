import { isEnvConfigured } from "@/features/aiden/providers/env-gate";
import {
  AidenProviderNotConfiguredError,
  type AidenGenerationResult,
  type AidenProvider,
} from "@/features/aiden/providers/types";

const ENV_VAR = "AIDEN_GRAFT_PROVIDER_API_KEY";

/**
 * Graft: custom monument/prop/asset generation (3D modality). No vendor is
 * wired yet — fails closed like an unconfigured Stripe key. 3D asset
 * generation is a narrower vendor space than image generation (Vest) or
 * text/structured-data generation (Terra); pick deliberately, don't guess.
 * See ROADMAP.md Phase 14, open question 1.
 */
export const graftProvider: AidenProvider = {
  product: "GRAFT",
  isConfigured(): boolean {
    return isEnvConfigured(ENV_VAR);
  },
  async generate(): Promise<AidenGenerationResult> {
    if (!this.isConfigured()) {
      throw new AidenProviderNotConfiguredError("GRAFT", ENV_VAR);
    }
    // TODO(aiden-graft): real vendor call goes here once a provider is chosen.
    throw new AidenProviderNotConfiguredError("GRAFT", ENV_VAR);
  },
};
