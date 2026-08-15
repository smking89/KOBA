import { runInSandbox } from "@/features/aiden/os/shared/sandbox";
import type { AidenComponent } from "@/features/aiden/os/shared/types";

/**
 * Builds a real Agent/Kernel/Engine/Sandbox node from just a kernel
 * (validation/decision logic) and an engine (the actual operation). Used
 * for every node in the architecture — Master, each Category's
 * SubMasterAgent, and each Agent — so the four-part shape is genuinely
 * present everywhere without hand-duplicating the wiring per node.
 *
 * Composition order matches the spec's execution flow: kernel runs first
 * (validates/transforms input), then engine runs inside sandbox
 * (isolated/bounded), and agent is the public entry that does both in order.
 */
export function composeComponent<Input, Output>(parts: {
  kernel: (input: Input) => Promise<Input>;
  engine: (input: Input) => Promise<Output>;
  label: string;
  timeoutMs?: number;
}): AidenComponent<Input, Output> {
  const sandbox = (input: Input): Promise<Output> =>
    runInSandbox(() => parts.engine(input), {
      label: parts.label,
      ...(parts.timeoutMs !== undefined ? { timeoutMs: parts.timeoutMs } : {}),
    });

  const agent = async (input: Input): Promise<Output> => {
    const validated = await parts.kernel(input);
    return sandbox(validated);
  };

  return { agent, kernel: parts.kernel, engine: parts.engine, sandbox };
}
