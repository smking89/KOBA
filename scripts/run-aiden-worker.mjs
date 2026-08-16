/**
 * VPS worker for Phase 14G Aiden generation.
 *
 * Queue: PostgreSQL AidenJob rows with optimistic `version` claims.
 * Redis/Upstash is used only for HTTP rate limits, not this queue.
 *
 * Usage:
 *   pnpm aiden:worker
 *   AIDEN_WORKER_LOOP=true pnpm aiden:worker
 *
 * Default is one batch (cron-friendly). Set AIDEN_WORKER_LOOP=true for a
 * long-running process with SIGINT/SIGTERM graceful shutdown.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("[aiden-worker] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { runAidenBatch } = await import("../features/aiden/services/aiden-worker.service.ts");

const intervalMs = Number.parseInt(process.env.AIDEN_WORKER_INTERVAL_MS ?? "5000", 10);

await runWorkerMain({
  name: "aiden",
  loop: process.env.AIDEN_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 5000,
  runOnce: async () => {
    const batch = await runAidenBatch({ concurrency: 2, limit: 8 });
    const failed = batch.results.filter((row) => row.state === "FAILED").length;
    return {
      outcome: failed > 0 ? "failure" : "success",
      claimed: batch.claimed,
      failed,
    };
  },
});
