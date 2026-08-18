/**
 * VPS cron for the durable RCON delivery queue (RconCommandJob):
 * claims PENDING jobs with runAfter <= now and retries them with
 * exponential backoff (features/payments/services/rcon-queue.service.ts).
 * The first attempt for any order runs inline from the Stripe webhook
 * (deliverRconKitForOrder) — this worker only picks up what that first
 * attempt left behind: transient failures waiting on backoff.
 *
 * Usage:
 *   pnpm rcon:worker
 *   RCON_WORKER_LOOP=true pnpm rcon:worker
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("[rcon-worker] DATABASE_URL is required.");
  process.exit(1);
}

const { register } = await import("tsx/esm/api");
register();

const { runWorkerMain } = await import("../lib/observability/worker-main.ts");
const { runRconDeliveryWorker } = await import(
  "../features/payments/services/rcon-queue.service.ts"
);

const intervalMs = Number.parseInt(process.env.RCON_WORKER_INTERVAL_MS ?? "15000", 10);

await runWorkerMain({
  name: "rcon-delivery",
  loop: process.env.RCON_WORKER_LOOP === "true",
  intervalMs: Number.isSafeInteger(intervalMs) && intervalMs >= 1000 ? intervalMs : 15_000,
  runOnce: async () => {
    const result = await runRconDeliveryWorker(20);
    return {
      outcome: "success",
      claimed: result.claimed,
      failed: result.failed,
      queueDepth: result.queueDepth,
      oldestJobAgeMs: result.oldestJobAgeMs,
    };
  },
});
