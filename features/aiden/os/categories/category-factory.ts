import { composeComponent } from "@/features/aiden/os/shared/compose";
import { AidenOsError, type AidenComponent } from "@/features/aiden/os/shared/types";
import type { AidenCategoryName } from "@/features/aiden/os/orchestration/types";

export type CategoryAgentRegistry = Record<string, AidenComponent<unknown, unknown>>;

export type AidenCategory = {
  name: AidenCategoryName;
  /** The category's own SubMasterAgent/Kernel/Engine/Sandbox — dispatches
   * to one of `agents` by id. This is what "breaks the task into
   * sub-tasks" in the spec's execution flow means today: for every
   * current Aiden use case one task maps to exactly one agent call, so
   * "breaking into sub-tasks" is the identity operation — this is real
   * dispatch logic, ready to do actual decomposition once a category
   * needs it, not a fake pass-through. */
  subMaster: AidenComponent<{ agentId: string; payload: unknown }, unknown>;
  agents: CategoryAgentRegistry;
};

export function createCategory(
  name: AidenCategoryName,
  agents: CategoryAgentRegistry,
): AidenCategory {
  const subMaster = composeComponent<{ agentId: string; payload: unknown }, unknown>({
    label: `category:${name}`,
    kernel: async (input) => {
      if (!(input.agentId in agents)) {
        throw new AidenOsError(
          `Category "${name}" has no agent registered for "${input.agentId}".`,
          "NOT_CONFIGURED",
          "sub-master-kernel",
        );
      }
      return input;
    },
    engine: async (input) => {
      const agent = agents[input.agentId];
      if (!agent) {
        throw new AidenOsError(
          `Category "${name}" has no agent "${input.agentId}".`,
          "NOT_CONFIGURED",
        );
      }
      return agent.agent(input.payload);
    },
  });

  return { name, subMaster, agents };
}
