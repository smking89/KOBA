import { isEnvConfigured } from "@/features/aiden/providers/env-gate";
import {
  AidenProviderNotConfiguredError,
  type AidenGenerationResult,
  type AidenProvider,
} from "@/features/aiden/providers/types";

const ENV_VAR = "AIDEN_VEST_PROVIDER_API_KEY";

/**
 * Vest: skin generation (image modality). No vendor is wired yet — this
 * fails closed exactly like an unconfigured Stripe key, ready for a real
 * image-generation vendor's SDK to be dropped into `generate()` once
 * AIDEN_VEST_PROVIDER_API_KEY is set to a real credential. Do not guess a
 * vendor here; that's a client decision (see ROADMAP.md Phase 14, open
 * question 1).
 */
export const vestProvider: AidenProvider = {
  product: "VEST",
  isConfigured(): boolean {
    return isEnvConfigured(ENV_VAR);
  },
  async generate(): Promise<AidenGenerationResult> {
    if (!this.isConfigured()) {
      throw new AidenProviderNotConfiguredError("VEST", ENV_VAR);
    }
    // TODO(aiden-vest): real vendor call goes here once a provider is chosen.
    throw new AidenProviderNotConfiguredError("VEST", ENV_VAR);
  },
};
