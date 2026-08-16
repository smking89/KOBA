import { wrapExternalModel } from "@/features/aiden/os/adapters/external-model-adapter";
import type { AidenComponent } from "@/features/aiden/os/shared/types";
import { getProvider } from "@/features/aiden/providers/registry";
import type {
  AidenProduct,
  AidenGenerationInput,
  AidenGenerationResult,
} from "@/features/aiden/providers/types";
import { AIDEN_PRODUCTS } from "@/features/aiden/providers/types";
import type { CategoryAgentRegistry } from "@/features/aiden/os/categories/category-factory";

/**
 * Adien.Category.Generation.Agent.<Vest|Graft|Terra>: each is the existing
 * vendor provider (features/aiden/providers/*) wrapped as an
 * Adien.ExternalModelAdapter, giving it the standard Agent/Kernel/Engine/
 * Sandbox shape. One factory produces all three rather than three
 * hand-duplicated files — they're structurally identical, only the
 * underlying provider differs.
 */
function createGenerationAgent(
  product: AidenProduct,
): AidenComponent<AidenGenerationInput, AidenGenerationResult> {
  const provider = getProvider(product);
  return wrapExternalModel({
    id: product.toLowerCase(),
    isConfigured: () => provider.isConfigured(),
    call: (input) => provider.generate(input),
  });
}

export const generationAgents: CategoryAgentRegistry = Object.fromEntries(
  AIDEN_PRODUCTS.map((product) => [
    product.toLowerCase(),
    createGenerationAgent(product) as AidenComponent<unknown, unknown>,
  ]),
);
