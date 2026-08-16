import { composeComponent } from "@/features/aiden/os/shared/compose";
import { AidenOsError, type AidenComponent } from "@/features/aiden/os/shared/types";

/** Adien.AgentAdapter: wraps a user-provided custom agent (any async
 * function conforming to Input -> Output) into the standard shape, so it
 * can be routed and executed identically to a built-in Aiden agent. */
export function wrapAgent<Input, Output>(
  id: string,
  run: (input: Input) => Promise<Output>,
): AidenComponent<Input, Output> {
  return composeComponent({
    label: `agent:${id}`,
    kernel: async (input) => {
      if (typeof run !== "function") {
        throw new AidenOsError(`Agent "${id}" is not callable.`, "INVALID", "kernel");
      }
      return input;
    },
    engine: run,
  });
}
