import { AidenOsError } from "@/features/aiden/os/shared/types";
import type { AidenCategoryName, TaskRequest } from "@/features/aiden/os/orchestration/types";

/** Adien.CategoryRouter: pure mapping from a task's namespace prefix to a
 * category. "generation.vest" -> GENERATION. Extend this table as new
 * categories get real agents; it deliberately does not infer/guess. */
const PREFIX_TO_CATEGORY: Record<string, AidenCategoryName> = {
  generation: "GENERATION",
  logic: "LOGIC",
  data: "DATA",
  automation: "AUTOMATION",
  interface: "INTERFACE",
};

export function resolveCategory(task: TaskRequest): AidenCategoryName {
  const prefix = task.taskType.split(".")[0] ?? "";
  const category = PREFIX_TO_CATEGORY[prefix];
  if (!category) {
    throw new AidenOsError(`No category maps to task prefix "${prefix}".`, "ROUTING_FAILED");
  }
  return category;
}
