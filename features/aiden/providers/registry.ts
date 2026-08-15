import { graftProvider } from "@/features/aiden/providers/graft-provider";
import { terraProvider } from "@/features/aiden/providers/terra-provider";
import type { AidenProduct, AidenProvider } from "@/features/aiden/providers/types";
import { vestProvider } from "@/features/aiden/providers/vest-provider";

const REGISTRY: Record<AidenProduct, AidenProvider> = {
  VEST: vestProvider,
  GRAFT: graftProvider,
  TERRA: terraProvider,
};

export function getProvider(product: AidenProduct): AidenProvider {
  return REGISTRY[product];
}
