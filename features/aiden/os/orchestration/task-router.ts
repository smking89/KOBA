import { AidenOsError } from "@/features/aiden/os/shared/types";
import type { TaskRequest } from "@/features/aiden/os/orchestration/types";

const TASK_TYPE_PATTERN = /^[a-z]+\.[a-z0-9-]+$/;

/** Adien.TaskRouter: validates/normalizes an incoming request before
 * anything else touches it. Pure — no I/O. */
export function normalizeTaskRequest(input: { taskType: unknown; payload: unknown }): TaskRequest {
  if (typeof input.taskType !== "string" || !TASK_TYPE_PATTERN.test(input.taskType)) {
    throw new AidenOsError(
      `Invalid task type "${String(input.taskType)}" — expected "<category>.<agent>".`,
      "INVALID",
      "task-router",
    );
  }
  return { taskType: input.taskType, payload: input.payload };
}
