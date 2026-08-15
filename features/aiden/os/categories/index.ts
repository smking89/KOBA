import {
  createCategory,
  type AidenCategory,
} from "@/features/aiden/os/categories/category-factory";
import { generationAgents } from "@/features/aiden/os/categories/generation/agents";
import type { AidenCategoryName } from "@/features/aiden/os/orchestration/types";

/**
 * Adien.Category.*: Generation is real (Vest/Graft/Terra). Logic, Data,
 * Automation, and Interface are genuine category shells — the same
 * SubMasterAgent/Kernel/Engine/Sandbox shape, routable today — with zero
 * agents registered. They stay empty until a real feature needs one;
 * adding an agent to any of them is a matter of populating its registry,
 * no structural change to this file or the routing layers.
 */
const categories: Record<AidenCategoryName, AidenCategory> = {
  GENERATION: createCategory("GENERATION", generationAgents),
  LOGIC: createCategory("LOGIC", {}),
  DATA: createCategory("DATA", {}),
  AUTOMATION: createCategory("AUTOMATION", {}),
  INTERFACE: createCategory("INTERFACE", {}),
};

export function getCategory(name: AidenCategoryName): AidenCategory {
  return categories[name];
}
