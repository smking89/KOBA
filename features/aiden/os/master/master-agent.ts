import { composeComponent } from "@/features/aiden/os/shared/compose";
import { route } from "@/features/aiden/os/orchestration/orchestration-layer";
import { getCategory } from "@/features/aiden/os/categories";
import type { RoutingDecision, TaskRequest } from "@/features/aiden/os/orchestration/types";

type MasterInput = { taskType: string; payload: unknown };
/** Kernel resolves routing once and carries the decision forward, rather
 * than routing again in the engine — routing is pure and cheap, but
 * there's no reason to compute it twice. */
type MasterRouted = { task: TaskRequest; decision: RoutingDecision };

/**
 * Adien.MasterAgent: the single entry point for the whole OS. Execution
 * flow (matches the spec):
 *   1. MasterAgent receives a request (this file's `agent`).
 *   2. AdapterLayer wrapping already happened when each agent was
 *      registered (features/aiden/os/categories/generation/agents.ts) —
 *      dynamic runtime registration of a user-provided component would
 *      also go through AdapterLayer.wrap before reaching this point.
 *   3. OrchestrationLayer decides the category (this file's `kernel`,
 *      via orchestration-layer.ts's route()).
 *   4-5. Category.SubMasterAgent dispatches to the specific
 *        Category.Agent.<Task> (this file's `engine`).
 *   6-8. That agent's own Kernel -> Engine -> Sandbox run (see
 *        shared/compose.ts — every agent is built from the same factory).
 *   9. Result bubbles back up through this file's `agent`.
 */
export const masterAgent = composeComponent<MasterInput, unknown>({
  label: "master",
  kernel: async (input): Promise<MasterInput> => {
    // Throws AidenOsError on anything malformed before any agent
    // execution is attempted. The routing decision itself is recomputed
    // in engine (composeComponent's Input type is fixed at MasterInput,
    // so kernel can't smuggle extra data through) — cheap and pure, so
    // recomputing it isn't a real cost, just not memoized across the two.
    route(input);
    return input;
  },
  engine: async (input): Promise<unknown> => {
    const routed: MasterRouted = route(input);
    const category = getCategory(routed.decision.category);
    return category.subMaster.agent({
      agentId: routed.decision.agentId,
      payload: routed.task.payload,
    });
  },
});
