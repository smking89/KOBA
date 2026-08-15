import { composeComponent } from "@/features/aiden/os/shared/compose";
import { AidenOsError, type AidenComponent } from "@/features/aiden/os/shared/types";

/** Adien.ExternalModelAdapter: wraps a hosted vendor API (Tripo, or
 * whichever provider a given Category.Agent is configured with) into the
 * standard Agent/Kernel/Engine/Sandbox shape. This is what
 * features/aiden/providers/{vest,graft,terra}-provider.ts get wrapped by. */
export type ExternalModelConfig<Input, Output> = {
  id: string;
  isConfigured: () => boolean;
  call: (input: Input) => Promise<Output>;
};

export function wrapExternalModel<Input, Output>(
  config: ExternalModelConfig<Input, Output>,
): AidenComponent<Input, Output> {
  return composeComponent({
    label: `external-model:${config.id}`,
    kernel: async (input) => {
      if (!config.isConfigured()) {
        throw new AidenOsError(
          `External model "${config.id}" is not configured.`,
          "NOT_CONFIGURED",
          "kernel",
        );
      }
      return input;
    },
    engine: (input) => config.call(input),
  });
}
