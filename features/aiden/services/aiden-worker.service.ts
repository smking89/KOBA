import { mapWithConcurrency } from "@/features/aiden/lib/concurrency";
import {
  AIDEN_WORKER_BATCH,
  AIDEN_WORKER_CONCURRENCY,
  aidenWorkerHealth,
} from "@/features/aiden/lib/worker-health";
import { claimQueuedJobs, processClaimedJob } from "@/features/aiden/services/aiden.service";

export { AIDEN_WORKER_BATCH, AIDEN_WORKER_CONCURRENCY, aidenWorkerHealth };

export async function runAidenBatch(opts?: {
  concurrency?: number;
  limit?: number;
  workerId?: string;
}) {
  const concurrency = opts?.concurrency ?? AIDEN_WORKER_CONCURRENCY;
  const claimed = await claimQueuedJobs({
    limit: opts?.limit ?? AIDEN_WORKER_BATCH,
    workerId: opts?.workerId ?? "aiden-worker",
  });
  const results = await mapWithConcurrency(claimed, concurrency, async (publicRef) => {
    try {
      return await processClaimedJob(publicRef);
    } catch (error) {
      return {
        publicRef,
        state: "FAILED" as const,
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  });
  return { claimed: claimed.length, results };
}
