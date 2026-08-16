import { composeComponent } from "@/features/aiden/os/shared/compose";
import type { AidenComponent } from "@/features/aiden/os/shared/types";

/** Adien.ToolAdapter: wraps a single-purpose, typically-synchronous
 * operation (a "tool" rather than a stateful agent) into the standard
 * shape. Structurally identical to AgentAdapter in this pass — the
 * distinction is conceptual (a tool does one deterministic thing; an
 * agent may itself route to sub-steps), not a different execution path
 * today. Kept as a separate adapter per the spec so tool-specific behavior
 * (e.g. stricter timeouts) has a place to live later without touching
 * agent-adapter.ts's contract. */
export function wrapTool<Input, Output>(
  id: string,
  run: (input: Input) => Promise<Output>,
  opts: { timeoutMs?: number } = {},
): AidenComponent<Input, Output> {
  return composeComponent({
    label: `tool:${id}`,
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    kernel: async (input) => input,
    engine: run,
  });
}
