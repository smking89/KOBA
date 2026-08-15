import { normalizeTaskRequest } from "@/features/aiden/os/orchestration/task-router";
import { resolveCategory } from "@/features/aiden/os/orchestration/category-router";
import { resolveAgentId } from "@/features/aiden/os/orchestration/agent-router";
import type { RoutingDecision, TaskRequest } from "@/features/aiden/os/orchestration/types";

/** Adien.OrchestrationLayer: TaskRouter -> CategoryRouter -> AgentRouter,
 * composed into one call. This is step 3 of the execution flow in the spec:
 * "OrchestrationLayer decides the correct category." */
export function route(input: { taskType: unknown; payload: unknown }): {
  task: TaskRequest;
  decision: RoutingDecision;
} {
  const task = normalizeTaskRequest(input);
  const category = resolveCategory(task);
  const agentId = resolveAgentId(task);
  return { task, decision: { category, agentId } };
}
