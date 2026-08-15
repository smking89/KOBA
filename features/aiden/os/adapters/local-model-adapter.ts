import { composeComponent } from "@/features/aiden/os/shared/compose";
import { AidenOsError, type AidenComponent } from "@/features/aiden/os/shared/types";

export type LocalModelFormat = "GGUF" | "ONNX" | "TENSORRT" | "PYTORCH";

export type LocalModelConfig = {
  id: string;
  format: LocalModelFormat;
  /** Path/URI to the weights file — recorded for future use, not read yet. */
  weightsPath: string;
};

/**
 * Adien.LocalModelAdapter: wraps a locally-hosted model (GGUF/ONNX/
 * TensorRT/PyTorch weights). Genuinely NOT runnable in this pass — this is
 * a Next.js web app with no GPU inference infrastructure (no model server,
 * no runtime for any of these formats), and standing one up is a real
 * infra decision (self-hosted GPU boxes vs. a managed inference platform)
 * out of scope here. This adapter fails closed exactly like an
 * unconfigured external model — same shape, same NOT_CONFIGURED contract
 * — rather than silently no-op-ing, so it's ready to have a real local
 * inference runtime dropped in later without changing any calling code.
 */
export function wrapLocalModel<Input, Output>(
  config: LocalModelConfig,
): AidenComponent<Input, Output> {
  return composeComponent<Input, Output>({
    label: `local-model:${config.id}`,
    kernel: async () => {
      throw new AidenOsError(
        `Local model "${config.id}" (${config.format}) has no inference runtime configured in this deployment.`,
        "NOT_CONFIGURED",
        "kernel",
      );
    },
    engine: async () => {
      throw new AidenOsError(
        `Local model "${config.id}" has no inference runtime.`,
        "NOT_CONFIGURED",
      );
    },
  });
}
