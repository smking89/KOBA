import { emitAlert } from "@/lib/observability/alerts";
import { runWithObservabilityContext } from "@/lib/observability/context";
import { recordWorkerHeartbeat } from "@/lib/observability/heartbeat";
import { logger } from "@/lib/observability/logger";
import { newCorrelationId } from "@/lib/observability/request-id";

export type WorkerRunResult = {
  outcome: "success" | "failure";
  claimed?: number;
  failed?: number;
  queueDepth?: number;
  oldestJobAgeMs?: number;
};

type WorkerMainOptions = {
  name: string;
  loop: boolean;
  intervalMs: number;
  runOnce: () => Promise<WorkerRunResult | void>;
};

function sleep(ms: number, abort: { value: boolean }) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const check = setInterval(() => {
      if (abort.value) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 200);
  });
}

export async function runWorkerMain(options: WorkerMainOptions): Promise<void> {
  const shuttingDown = { value: false };
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      shuttingDown.value = true;
      logger.info("Worker shutdown requested", {
        event: "worker_stop",
        operation: options.name,
        extra: { signal },
      });
    });
  }

  logger.info(options.loop ? "Worker loop starting" : "Worker one-shot starting", {
    event: "worker_start",
    operation: options.name,
    extra: { loop: options.loop, intervalMs: options.intervalMs },
    outcome: options.loop ? "success" : "inactive",
  });

  if (!options.loop) {
    logger.info("Worker loop disabled; running a single batch", {
      event: "worker_inactive_loop",
      operation: options.name,
      outcome: "inactive",
    });
  }

  const execute = async () => {
    const correlationId = newCorrelationId();
    const started = Date.now();
    return runWithObservabilityContext(
      { correlationId, worker: options.name, route: `worker:${options.name}` },
      async () => {
        logger.info("Worker heartbeat", {
          event: "worker_heartbeat",
          operation: options.name,
          extra: { loop: options.loop },
        });
        recordWorkerHeartbeat({ worker: options.name, loop: options.loop, at: Date.now() });
        try {
          const result = (await options.runOnce()) ?? { outcome: "success" as const };
          const durationMs = Date.now() - started;
          recordWorkerHeartbeat({
            worker: options.name,
            loop: options.loop,
            lastSuccessAt: Date.now(),
            lastDurationMs: durationMs,
            queueDepth: result.queueDepth ?? null,
            oldestJobAgeMs: result.oldestJobAgeMs ?? null,
          });
          logger.info("Worker batch completed", {
            event: "job_success",
            operation: options.name,
            durationMs,
            outcome: result.outcome,
            extra: { claimed: result.claimed, failed: result.failed },
          });
          if ((result.failed ?? 0) > 0) {
            await emitAlert(
              "job_terminal_failure",
              "Worker batch contained terminal job failures",
              {
                labels: { worker: options.name, operation: options.name },
              },
            );
          }
          if ((result.queueDepth ?? 0) >= 50) {
            await emitAlert("queue_backlog", "Worker reported a deep queue", {
              labels: { worker: options.name, operation: options.name },
              extra: { queueDepth: result.queueDepth },
            });
          }
        } catch (error) {
          recordWorkerHeartbeat({
            worker: options.name,
            loop: options.loop,
            lastFailureAt: Date.now(),
            lastDurationMs: Date.now() - started,
          });
          await emitAlert("job_terminal_failure", "Worker batch failed", {
            labels: { worker: options.name, operation: options.name, errorClass: "worker" },
            error,
          });
        }
      },
    );
  };

  await execute();
  while (options.loop && !shuttingDown.value) {
    await sleep(options.intervalMs, shuttingDown);
    if (shuttingDown.value) break;
    await execute();
  }
}
