import type { AidenJobState } from "@/features/aiden/lib/types";

const ALLOWED: Record<AidenJobState, readonly AidenJobState[]> = {
  DRAFT: ["QUEUED", "CANCELLED"],
  QUEUED: ["PROCESSING", "CANCELLED", "FAILED"],
  PROCESSING: ["MODERATING", "QUEUED", "SUCCEEDED", "FAILED", "CANCELLED"],
  MODERATING: ["SUCCEEDED", "QUEUED", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};

export function canTransitionAidenJob(from: AidenJobState, to: AidenJobState): boolean {
  return ALLOWED[from].includes(to);
}

export function assertAidenTransition(from: AidenJobState, to: AidenJobState): void {
  if (!canTransitionAidenJob(from, to)) {
    throw new Error(`Invalid Aiden job transition ${from} → ${to}`);
  }
}
