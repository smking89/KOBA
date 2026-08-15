import { composeComponent } from "@/features/aiden/os/shared/compose";
import { AidenOsError, type AidenComponent } from "@/features/aiden/os/shared/types";

export type WorkflowStep = (input: unknown) => Promise<unknown>;

/** Adien.WorkflowAdapter: wraps an ordered sequence of steps (each step's
 * output feeds the next step's input) into the standard shape. Sequential
 * only in this pass — a real DAG scheduler (parallel branches, conditional
 * steps) is a bigger undertaking than any current Aiden use case needs;
 * revisit if a workflow ever genuinely needs branching. */
export function wrapWorkflow(
  id: string,
  steps: readonly WorkflowStep[],
): AidenComponent<unknown, unknown> {
  return composeComponent<unknown, unknown>({
    label: `workflow:${id}`,
    kernel: async (input) => {
      if (steps.length === 0) {
        throw new AidenOsError(`Workflow "${id}" has no steps.`, "INVALID", "kernel");
      }
      return input;
    },
    engine: async (input) => {
      let value = input;
      for (const step of steps) {
        value = await step(value);
      }
      return value;
    },
  });
}
