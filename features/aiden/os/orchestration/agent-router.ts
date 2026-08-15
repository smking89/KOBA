import { AidenOsError } from "@/features/aiden/os/shared/types";
import type { TaskRequest } from "@/features/aiden/os/orchestration/types";

/** Adien.AgentRouter: pure extraction of the agent id from a task type —
 * "generation.vest" -> "vest". Whether that agent id is actually
 * registered is checked later, by the category itself (it owns its own
 * agent registry) — this router only parses, it doesn't validate existence. */
export function resolveAgentId(task: TaskRequest): string {
  const agentId = task.taskType.split(".")[1];
  if (!agentId) {
    throw new AidenOsError(`Task type "${task.taskType}" has no agent segment.`, "ROUTING_FAILED");
  }
  return agentId;
}
