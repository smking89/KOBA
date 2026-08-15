import { isEnvConfigured } from "@/features/aiden/providers/env-gate";
import {
  AidenProviderNotConfiguredError,
  type AidenGenerationResult,
  type AidenProvider,
} from "@/features/aiden/providers/types";

const ENV_VAR = "AIDEN_TERRA_PROVIDER_API_KEY";

/**
 * Terra: map/terrain generation. No vendor is wired yet — fails closed
 * like an unconfigured Stripe key. Note this modality doesn't map cleanly
 * onto a mainstream "frontier model" product the way Vest (image gen) does
 * — it may end up being a structured-output LLM call (map layout as JSON/
 * heightmap description) rather than a dedicated terrain-generation API.
 * See ROADMAP.md Phase 14, open question 1.
 */
export const terraProvider: AidenProvider = {
  product: "TERRA",
  isConfigured(): boolean {
    return isEnvConfigured(ENV_VAR);
  },
  async generate(): Promise<AidenGenerationResult> {
    if (!this.isConfigured()) {
      throw new AidenProviderNotConfiguredError("TERRA", ENV_VAR);
    }
    // TODO(aiden-terra): real vendor call goes here once a provider is chosen.
    throw new AidenProviderNotConfiguredError("TERRA", ENV_VAR);
  },
};
