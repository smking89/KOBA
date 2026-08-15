/** Aiden Studio OS — public entry point. See docs/aiden-studio-os.md for
 * the full architecture. Everything else under features/aiden/os/** is
 * internal; call sites (features/aiden/services/aiden.service.ts) should
 * only import from here. */
export { masterAgent } from "@/features/aiden/os/master/master-agent";
export { AidenOsError } from "@/features/aiden/os/shared/types";
export {
  registerAdapter,
  getAdapter,
  hasAdapter,
  type AdapterKind,
} from "@/features/aiden/os/adapters/adapter-layer";
export { wrapAgent } from "@/features/aiden/os/adapters/agent-adapter";
export { wrapTool } from "@/features/aiden/os/adapters/tool-adapter";
export { wrapWorkflow, type WorkflowStep } from "@/features/aiden/os/adapters/workflow-adapter";
export {
  wrapExternalModel,
  type ExternalModelConfig,
} from "@/features/aiden/os/adapters/external-model-adapter";
export {
  wrapLocalModel,
  type LocalModelConfig,
  type LocalModelFormat,
} from "@/features/aiden/os/adapters/local-model-adapter";
